const WebSocket = require("ws");
const express = require("express");
const app = express();
// Dòng này rất quan trọng cho Render: nó sẽ tự động lấy cổng (PORT) mà Render cung cấp.
// Nếu chạy ở máy bạn, nó sẽ dùng cổng 3000.
const PORT = process.env.PORT || 3000;

// Biến lưu trữ dữ liệu các phiên
let phienTruoc = null;
let lichSuPhien = []; // Lưu 10 kết quả gần nhất

// Địa chỉ WebSocket của cổng game
const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";

function connectWebSocket() {
    const ws = new WebSocket(WS_URL);

    ws.on("open", () => {
        console.log("[+] WebSocket đã kết nối thành công.");

        // Gói tin xác thực khi kết nối
        const authPayload = [
            1, "MiniGame", "", "",
            { agentId: "1", accessToken: "1-e5f41fc847e55893e0fdc9d937b6820a", reconnect: false }
        ];
        ws.send(JSON.stringify(authPayload));
        console.log("[>] Đã gửi thông tin xác thực.");

        // Gói tin yêu cầu dữ liệu game Tài Xỉu
        setTimeout(() => {
            const cmdPayload = [6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }];
            ws.send(JSON.stringify(cmdPayload));
            console.log("[>] Đã gửi yêu cầu lấy dữ liệu (cmd 2001).");
        }, 1000);
    });

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            if (Array.isArray(data) && data.length === 2 && data[0] === 5 && typeof data[1] === "object") {
                const d = data[1].d;

                if (typeof d === "object") {
                    const cmd = d.cmd;
                    const sid = d.sid;

                    // Lắng nghe kết quả phiên (cmd 2006)
                    if (cmd === 2006 && d.d1 !== undefined && d.d2 !== undefined && d.d3 !== undefined) {
                        const { d1, d2, d3, md5 } = d;
                        const total = d1 + d2 + d3;
                        const result = total >= 11 ? "Tài" : "Xỉu";

                        phienTruoc = {
                            phien: sid, xuc_xac_1: d1, xuc_xac_2: d2, xuc_xac_3: d3,
                            tong: total, ket_qua: result, md5
                        };

                        lichSuPhien.unshift({ phien: sid, ket_qua: result, tong: total });
                        if (lichSuPhien.length > 10) lichSuPhien.pop();

                        console.log(`🎲 Phiên ${sid}: ${d1}-${d2}-${d3} = ${total} ➜ ${result}`);
                    }

                    // Lắng nghe thông tin phiên kế tiếp (cmd 2005)
                    if (cmd === 2005) {
                        console.log(`⏭️  Chuẩn bị cho phiên kế tiếp: ${sid}`);
                    }
                }
            }
        } catch (err) {
            console.error("[!] Lỗi xử lý message:", err.message);
        }
    });

    ws.on("close", () => {
        console.log("[x] Kết nối WebSocket đã đóng. Tự động kết nối lại sau 3 giây...");
        setTimeout(connectWebSocket, 3000);
    });

    ws.on("error", (err) => {
        console.error("[!] Lỗi WebSocket:", err.message);
    });
}

// Bắt đầu kết nối WebSocket
connectWebSocket();

// ==========================================================
// PHẦN API SERVER SỬ DỤNG EXPRESS
// ==========================================================

// API chính trả về kết quả theo định dạng yêu cầu
app.get("/", (req, res) => {
    if (!phienTruoc) {
        return res.status(404).json({
            "message": "Đang chờ dữ liệu từ phiên đầu tiên, vui lòng thử lại sau giây lát...",
            "id": "@ghetvietcode - @tranbinh012 - @Phucdzvl2222"
        });
    }

    // --- Logic dự đoán ngẫu nhiên ---
    const ketQuaThucTe = phienTruoc.ket_qua;
    const duDoan = Math.random() < 0.5 ? (ketQuaThucTe === 'Tài' ? 'Xỉu' : 'Tài') : ketQuaThucTe;

    // Tạo đối tượng JSON để trả về
    const responseData = {
        "thoi_gian": new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
        "Phien": phienTruoc.phien,
        "md5": phienTruoc.md5,
        "d1": phienTruoc.xuc_xac_1,
        "d2": phienTruoc.xuc_xac_2,
        "d3": phienTruoc.xuc_xac_3,
        "rs": ketQuaThucTe,
        "Du_doan": duDoan,
        "id": "@ghetvietcode - @tranbinh012 - @Phucdzvl2222"
    };

    res.json(responseData);
});

// API phụ để xem lịch sử 10 phiên gần nhất
app.get("/history", (req, res) => {
    res.json({
        so_luong: lichSuPhien.length,
        lich_su: lichSuPhien,
    });
});

// Chức năng giúp server không "ngủ" trên các nền tảng hosting miễn phí
setInterval(() => {
    console.log("💤 Ping để giữ cho máy chủ hoạt động...");
}, 1000 * 60 * 10); // Ping mỗi 10 phút

// Khởi động server
app.listen(PORT, () => {
    console.log(`✅ API server đang chạy tại cổng ${PORT}`);
    console.log(`   - Môi trường: ${process.env.PORT ? 'Render (Production)' : 'Local'}`);
    console.log(`   - Để truy cập, hãy dùng URL mà Render cung cấp cho bạn.`);
});
