# CITO CHILLER – Web Bluetooth App (Firmware 2.0.0)

Web App điều khiển máy làm lạnh nước bể cá **CITO CHILLER** qua **Web Bluetooth** trực tiếp trên trình duyệt, chuẩn giao thức firmware 2.0.0 (`ble_control.cpp`).

---

## 1. Cấu trúc thư mục và vai trò các file

| Đường dẫn file | Vai trò / Chức năng |
|---|---|
| `src/types/system.ts` | Kiểu dữ liệu TypeScript: `ChillerStatus` (gói `st`), `ChillerConfig` (gói `cf`), `PacketAck`, `PacketWifiList`, bảng 12 mã lỗi E1–E12 tiếng Việt, hàm `formatCurrent(mA)`, hàm `parseErrors()`, hàm `getStateDetails()`. |
| `src/services/packetParser.ts` | Lớp `PacketFramingBuffer`: giải mã luồng byte `TextDecoder('utf-8', {stream:true})`, cắt gói theo `\n`, cơ chế xả đệm > 8KB chống treo; hàm thuần `applyPacket(prev, pkt)` cập nhật state không gây side-effect (T1 null không giữ số cũ). |
| `src/services/bleService.ts` | Lớp quản lý `ChillerBleManager`: tìm thiết bị `CITO-CH-XXXX`, kết nối 2 UUID STATUS & COMMAND, tự gửi `AUTH` sau kết nối, hàng đợi lệnh ghi tuần tự (`writeChain`), tự động kết nối lại 3 lần (2s/4s/6s), ghi nhớ mã PIN. |
| `src/services/demo.ts` | Máy giả lập `DemoChillerDevice` trong trình duyệt: mô phỏng động học nhiệt độ giảm khi 2 sò chạy, nóng tản nhiệt T3, quạt giải nhiệt, kiểm tra test 10 phút, hỗ trợ các lệnh giả lập `SIM`. |
| `src/components/HomeTab.tsx` | Tab Trang chính: Nhiệt độ nước T1 to ở giữa, chỉnh nhiệt độ mục tiêu −/+ với độ trễ 600 ms, nút nguồn to (`POWER`), 3 chế độ quạt Tự động / Êm / Mạnh, 3 thẻ trạng thái Sò 1 + Van, Sò 2, Quạt (RPM riêng 2 quạt), tích hợp bảng Điều khiển thủ công (Manual Test), khung cảnh báo và nút Xóa lỗi khóa (`CLEAR_FAULTS`). |
| `src/components/ManualControlSection.tsx` | Mục Điều khiển & Bật/Tắt thủ công (Manual Test): Bật/Thoát chế độ TEST, đếm ngược 10 phút, công tắc Sò 1 (+ Van nước), Sò 2, thanh trượt quạt 0–100%, 4 kịch bản thử nhanh 1 chạm, hiển thị dòng điện và RPM thời gian thực. |
| `src/components/SettingsTab.tsx` | Tab Cài đặt: Cài đặt cơ bản (độ chênh `diff`, bíp phím, còi lỗi, tắt sò bảo trì) & Cài đặt nâng cao theo 4 nhóm (Điều khiển sò, Bảo vệ nhiệt, Quạt, Bảo vệ dòng điện). Chỉ gửi các khóa đã sửa. |
| `src/components/TechTab.tsx` | Tab Kỹ thuật cho thợ: Chế độ kiểm tra TEST độc lập, hiệu chuẩn bù nhiệt và đo điểm 0A (`ACS_ZERO`), bảng lệnh giả lập SIM, quét và cài WiFi nhà, hướng dẫn nạp OTA qua WiFi AP, đổi PIN, về mặc định, khởi động lại. |
| `src/components/ConnectModal.tsx` | Hộp thoại kết nối Bluetooth, nhập mã PIN, chuyển sang chế độ Demo và hướng dẫn tương thích trình duyệt (Chrome/Edge trên PC & Android, app Bluefy trên iOS). |
| `src/App.tsx` | Khung ứng dụng chính: thanh header hiển thị trạng thái kết nối + tên máy, hệ thống thông báo toast phản hồi ack, thanh điều hướng 3 tab chân trang. |
| `src/services/packetParser.test.ts` | Bộ kiểm thử tự động Vitest kiểm tra UTF-8 đa byte bị cắt đôi, xử lý nhiệt độ `null`, định dạng dòng mA/A, kiểm tra bitmask mã lỗi khóa `0x07E8`. |
| `.github/workflows/deploy.yml` | CI/CD GitHub Actions: Tự động cài đặt dependency (`esbuild@0.27.7`), lint, test, build tĩnh với đường dẫn tương đối và tự động deploy lên GitHub Pages. |
| `vite.config.ts` | Cấu hình Vite với `base: './'` (dùng đường dẫn tương đối cho mọi assets JS/CSS/HTML) giúp ứng dụng chạy được trên mọi subpath GitHub Pages mà không bị lỗi 404. |

---

## 2. Cách chạy và phát triển cục bộ

### Cài đặt thư viện
```bash
npm install
```

### Chạy máy chủ phát triển (Development Server)
```bash
npm run dev
```
Mở trình duyệt tại địa chỉ `http://localhost:3000`.

### Kiểm tra cú pháp và kiểu TypeScript (Lint)
```bash
npm run lint
```

### Chạy bộ kiểm thử tự động (Unit Tests)
```bash
npm test
```

### Đóng gói sản phẩm (Build Production)
```bash
npm run build
```
Thư mục `dist/` sẽ chứa toàn bộ mã nguồn tĩnh sẵn sàng triển khai.

---

## 3. Cách đẩy lên GitHub và kích hoạt GitHub Pages

1. **Khởi tạo và đẩy code lên kho lưu trữ:**
   ```bash
   git init
   git add .
   git commit -m "feat: CITO CHILLER Web Bluetooth 2.0.0"
   git branch -M main
   git remote add origin https://github.com/<tai-khoan>/<ten-repo>.git
   git push -u origin main
   ```

2. **Bật GitHub Pages:**
   - Truy cập **Settings** của repository trên GitHub.
   - Chọn mục **Pages** (cột bên trái).
   - Tại phần **Build and deployment** -> **Source**, chọn **GitHub Actions**.
   - Mỗi khi push commit lên nhánh `main`, file `.github/workflows/deploy.yml` sẽ tự động chạy lint, test, build và xuất bản trang web.

---

## 4. Tương thích thiết bị & Trình duyệt

- **Máy tính Windows / macOS / Linux & Điện thoại Android:** Dùng trình duyệt **Google Chrome** hoặc **Microsoft Edge** (bật sẵn Web Bluetooth).
- **iPhone / iPad (iOS):** Safari của Apple không tích hợp Web Bluetooth. Người dùng tải ứng dụng miễn phí **Bluefy – Web BLE Browser** trên App Store rồi truy cập đường link web app để kết nối Bluetooth bình thường.
- **Khi không có máy thật:** Nhấn nút **&quot;Mở Chế Độ Dùng Thử (Demo)&quot;** để trải nghiệm đầy đủ các tính năng điều khiển và mô phỏng lỗi.
