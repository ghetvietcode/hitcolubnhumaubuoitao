const WebSocket = require("ws");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Biến lưu trữ dữ liệu
let phienTruoc = null;  // Dữ liệu phiên vừa có kết quả
let phienKeTiep = null; // Dữ liệu phiên sắp tới (chứa MD5 để dự đoán)

// Địa chỉ WebSocket của cổng game
const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";

function connectWebSocket() {
    const ws = new WebSocket(WS_URL);

    ws.on("open", () => {
        console.log("[+] WebSocket đã kết nối thành công.");

        // Gói tin xác thực
        const authPayload = [
            1, "MiniGame", "", "",
            { agentId: "1", accessToken: "1-e5f41fc847e55893e0fdc9d937b6820a", reconnect: false }
        ];
        ws.send(JSON.stringify(authPayload));
        console.log("[>] Đã gửi thông tin xác thực.");

        setTimeout(() => {
            const cmdPayload = [6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }];
            ws.send(JSON.stringify(cmdPayload));
            console.log("[>] Đã gửi yêu cầu lấy dữ liệu.");
        }, 1000);
    });

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            if (Array.isArray(data) && data.length === 2 && data[0] === 5 && typeof data[1] === "object") {
                const d = data[1].d;

                if (typeof d === "object") {
                    // Lắng nghe kết quả của phiên vừa kết thúc (cmd 2006)
                    if (d.cmd === 2006 && d.d1 !== undefined) {
                        const { d1, d2, d3, sid } = d;
                        const total = d1 + d2 + d3;
                        const result = total >= 11 ? "Tài" : "Xỉu";
                        phienTruoc = {
                            phien: sid,
                            xuc_xac_1: d1,
                            xuc_xac_2: d2,
                            xuc_xac_3: d3,
                            ket_qua: result
                        };
                        console.log(`🎲 KẾT QUẢ PHIÊN TRƯỚC (${sid}): ${result}`);
                    }

                    // Lắng nghe thông tin của phiên sắp tới (cmd 2005)
                    if (d.cmd === 2005) {
                        phienKeTiep = {
                            phien: d.sid, // Vẫn cần lấy phiên để log, nhưng không trả về API
                            md5: d.md5
                        };
                        console.log(`⏭️  CHUẨN BỊ PHIÊN SAU (${d.sid}) | MD5: ${d.md5}`);
                    }
                }
            }
        } catch (err) { /* Bỏ qua lỗi parse không quan trọng */ }
    });

    ws.on("close", () => {
        console.log("[x] Kết nối đã đóng. Tự động kết nối lại sau 3 giây...");
        setTimeout(connectWebSocket, 3000);
    });

    ws.on("error", (err) => {
        console.error("[!] Lỗi WebSocket:", err.message);
    });
}

connectWebSocket();

// ==========================================================
// PHẦN API SERVER
// ==========================================================

app.get("/txmd5", (req, res) => {
    if (!phienTruoc || !phienKeTiep) {
        return res.status(404).json({
            "message": "Đang chờ dữ liệu phiên, vui lòng thử lại sau giây lát...",
            "id": "@ghetvietcode - @tranbinh012 - @Phucdzvl2222"
        });
    }

    const duDoanPhienSau = Math.random() < 0.5 ? 'Tài' : 'Xỉu';

    // Tạo đối tượng JSON để trả về
    const responseData = {
        "thoi_gian": new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
        "ket_qua_phien_truoc": {
            "Phien": phienTruoc.phien,
            "d1": phienTruoc.xuc_xac_1,
            "d2": phienTruoc.xuc_xac_2,
            "d3": phienTruoc.xuc_xac_3,
            "rs": phienTruoc.ket_qua,
        },
        "thong_tin_phien_sau": {
            // ⭐ Đã bỏ "Phien" ở đây theo yêu cầu
            "md5": phienKeTiep.md5,
            "Du_doan": duDoanPhienSau,
        },
        "id": "@ghetvietcode - @tranbinh012 - @Phucdzvl2222"
    };

    res.json(responseData);
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`✅ API server đang chạy tại cổng ${PORT}`);
    console.log(`   - Truy cập vào /txmd5 trên URL của bạn để xem kết quả.`);
});
