# BÁO CÁO PHÂN TÍCH MÔ HÌNH KINH DOANH BUSINESS MODEL CANVAS

Dự án: Hệ thống Đo lường Sóng não, Hỗ trợ Giấc ngủ và Nghiên cứu Cảnh báo Sớm Đột quỵ NeuroLink

Tài liệu thuyết minh logic vận hành, số liệu điều tra các tệp khách hàng và phương án triển khai thực tế của dự án. Hồ sơ kỹ thuật đối chiếu: [PROJECT_CONTEXT.md](file:///D:/PRJ_Personal/software_neuronlink_eeg/docs/PROJECT_CONTEXT.md), [STARTUP_STRATEGY_BMC.md](file:///D:/PRJ_Personal/software_neuronlink_eeg/docs/STARTUP_STRATEGY_BMC.md).

I. LOGIC TỔNG THỂ VÀ NGUYÊN TẮC THIẾT KẾ MÔ HÌNH

1. Sự liên kết nhân quả giữa sản phẩm kỹ thuật và nhu cầu thực tế

Điểm nghẽn của nhiều đề tài kỹ thuật y sinh trong trường đại học là dừng lại ở mạch nguyên lý trên bàn thí nghiệm hoặc đặt mục tiêu thương mại hóa trực diện vào bệnh viện ngay khi chưa có giấy phép lưu hành. Thực tế quy trình kiểm định lâm sàng để được Bộ Y tế cấp Số lưu hành Trang thiết bị Y tế loại B hoặc C kéo dài từ 12 đến 24 tháng. Nếu chỉ trông chờ vào một đầu ra duy nhất tại bệnh viện, dự án sẽ bị đóng băng hoạt động và thiếu dữ liệu thực tế để cải tiến thuật toán.

Mô hình NeuroLink được thiết kế theo hướng đi tuần tự, lấy khả năng ứng dụng hợp pháp ở hiện tại để nuôi mục tiêu y tế chuyên sâu ở tương lai trên cùng một nền tảng phần cứng và phần mềm thống nhất:
- Nhánh học thuật và chăm sóc giấc ngủ (Triển khai ngay ở Giai đoạn 1): Sử dụng trực tiếp bo mạch đo điện não 6 lớp ADS1299 và trạm phân tích Web qEEG đã hoàn thiện để cung cấp Bộ Kit nghiên cứu mở cho các phòng thí nghiệm đại học và các cơ sở trị liệu giấc ngủ, song song với phiên bản vòng đeo vùng tai hỗ trợ theo dõi chất lượng giấc ngủ cho hộ gia đình (thuộc nhóm thiết bị chăm sóc sức khỏe thông thường theo Nghị định 98/2021/NĐ-CP).
- Nhánh cộng tác chuyên môn và huấn luyện AI: Mở miễn phí công cụ lọc nhiễu và định lượng sóng não phục vụ nghiên cứu cho bác sĩ trẻ và nghiên cứu sinh. Khi chuyên gia sử dụng công cụ và gán nhãn cho các bản ghi đã khử định danh, hệ thống tặng lại tín chỉ (Credit) để đổi lấy tài nguyên dữ liệu trên nền tảng. Cơ chế này giúp nhóm phát triển tích lũy kho dữ liệu sóng não có nhãn chuẩn mà không tốn kinh phí thuê chuyên gia gán nhãn.
- Nhánh sàng lọc y tế tuyến cơ sở (Mở rộng ở Giai đoạn 2 sau kiểm định): Kết hợp cùng Bệnh viện Đà Nẵng và Trung tâm Hỗ trợ Khởi nghiệp Đổi mới Sáng tạo Đà Nẵng (DISSC) triển khai đo đối chứng trong cơ chế thử nghiệm có kiểm soát (Sandbox Nghị quyết 136/2024/QH15), làm cơ sở xin cấp phép lưu hành chính thức trước khi đưa vào phòng khám chuyên khoa.

2. Nguyên tắc tách người đeo sử dụng và người theo dõi chi trả trong gia đình

Đối với nhóm người dùng gia đình tại Việt Nam, người cao tuổi (từ 55 tuổi trở lên) thường có tâm lý tiết kiệm, ngại thao tác điện thoại thông minh và hay giấu các triệu chứng mất ngủ, hoa mắt chóng mặt ban đêm. Ngược lại, con cái trưởng thành đi làm xa (từ 25 đến 45 tuổi) lại là người thường trực lo lắng cho sức khỏe cha mẹ ở quê và có khả năng tiếp cận công nghệ nhanh.

Vì vậy, sản phẩm tách bạch rõ trải nghiệm cho hai phía: phần cứng vòng đeo vùng tai dành cho cha mẹ được tối giản đến mức tự kích hoạt khi tiếp xúc da mà không cần bấm nút hay cài đặt; toàn bộ phần mềm theo dõi chất lượng ngủ sâu và cuộc gọi cảnh báo khi có bất đối xứng sóng não ban đêm được kết nối thẳng về điện thoại của người con.

II. PHÂN TÍCH CHI TIẾT 9 KHỐI BUSINESS MODEL CANVAS VÀ LỘ TRÌNH PHÁP LÝ

1. Phân khúc Khách hàng (Customer Segments) và Số liệu Điều tra Quy mô

a. Nội dung cô đọng đưa lên bảng BMC:
- Tệp 1 - Người dùng Giấc ngủ và Gia đình (Giai đoạn 1): Con cái đi làm xa (25-45 tuổi) và cha mẹ lớn tuổi (55+). Quy mô: hơn 10 triệu người Việt Nam rối loạn giấc ngủ (~30% người lớn); 14,8 đến 16 triệu người cao tuổi, khoảng 200.000 ca đột quỵ/năm với 76,8% nhập viện trễ giờ vàng 4,5 giờ.
- Tệp 2 - Tổ chức Học thuật và Trị liệu Giấc ngủ (Giai đoạn 1): Phòng Lab đại học và cơ sở nghỉ dưỡng phục hồi. Quy mô: hơn 240 trường đại học toàn quốc (gần 40 trường đào tạo Y Dược và hơn 65 khoa Kỹ thuật Y sinh, Điện tử, CNTT); riêng cụm Đà Nẵng - Hội An có hơn 220 khách sạn, resort 4-5 sao.
- Tệp 3 - Cộng đồng Chuyên môn Đọc và Gán nhãn (Đối tác nòng cốt): Bác sĩ trẻ, bác sĩ nội trú và nghiên cứu sinh. Quy mô: khoảng 10.000 bác sĩ tốt nghiệp mỗi năm trên cả nước cùng hàng ngàn học viên sau đại học cần công cụ xử lý tín hiệu và dữ liệu làm đề tài.
- Tệp 4 - Cơ sở Y tế Tuyến dưới và Viện Nghiên cứu Thần kinh (Giai đoạn 2-3): Phòng khám thần kinh, bệnh viện tuyến cơ sở và đơn vị nghiên cứu BCI, dược phẩm. Quy mô: cả nước mới có hơn 130 đơn vị đột quỵ trên tổng số hơn 1.500 bệnh viện, dẫn đến thiếu hụt lớn công cụ sàng lọc sớm tại tuyến dưới.

b. Dẫn chứng điều tra thực tế trên từng tệp khách hàng:
Mọi phân khúc mục tiêu của dự án đều dựa trên số liệu thống kê chính thức của cơ quan chuyên ngành tại Việt Nam thay vì suy đoán cảm tính:
- Điều tra Tệp 1 (Nhu cầu theo dõi giấc ngủ và tai biến ban đêm tại gia đình): Theo thống kê của Hội Y học Giấc ngủ Việt Nam, khoảng 30% người trưởng thành đang gặp các vấn đề rối loạn giấc ngủ (tương đương hơn 10 triệu người), riêng nhóm người cao tuổi tỷ lệ mất ngủ mạn tính chiếm từ 30% đến 40%. Số liệu từ Cục Thống kê và Bộ Y tế ghi nhận Việt Nam có từ 14,8 đến 16 triệu người từ 60 tuổi trở lên (trung bình mắc 3 đến 4 bệnh nền như tăng huyết áp, tim mạch). Mỗi năm cả nước xảy ra khoảng 200.000 ca đột quỵ mới nhưng chỉ 23,2% người bệnh đến viện trong khung giờ vàng 4,5 giờ đầu; 76,8% còn lại đến muộn, phần lớn do biến cố xảy ra trong lúc ngủ ban đêm không có người phát hiện kịp. Ngay tại Đà Nẵng, riêng khu phức hợp FPT Complex đã tập trung khoảng 8.000 kỹ sư công nghệ trẻ phần đông quê ở các tỉnh miền Trung sống xa cha mẹ.
- Điều tra Tệp 2 (Nhu cầu thiết bị đo mở ở trường đại học và cơ sở phục hồi giấc ngủ): Theo thống kê hệ thống giáo dục đại học của Bộ Giáo dục và Đào tạo, Việt Nam có hơn 240 trường đại học, trong đó gần 40 cơ sở đào tạo khối ngành sức khỏe (Y Dược) và hơn 65 khoa đào tạo Kỹ thuật Y sinh, Điện tử Viễn thông, Khoa học Máy tính và Trí tuệ Nhân tạo. Hiện các phòng thí nghiệm trong nước muốn đo sóng não thô phải đặt mua các bộ mạch ngoại nhập như OpenBCI từ Mỹ với thủ tục nhập khẩu lâu và chi phí cao. Bên cạnh đó, theo số liệu Sở Du lịch Đà Nẵng, riêng thành phố có 164 đến 167 cơ sở lưu trú 4-5 sao (kết hợp khu vực Hội An tạo thành cụm hơn 220 khách sạn và khu nghỉ dưỡng cao cấp) đang phát triển mạnh các gói trị liệu thư giãn, thiền định và phục hồi giấc ngủ cần số liệu đo đạc khách quan trước và sau liệu trình.
- Điều tra Tệp 3 (Nguồn lực bác sĩ trẻ và nhà nghiên cứu tham gia hệ sinh thái): Theo số liệu từ Bộ Y tế và Hội đồng Y khoa Quốc gia, mỗi năm cả nước có khoảng 10.000 bác sĩ tốt nghiệp ra trường, cùng hàng ngàn bác sĩ nội trú, học viên cao học tại các trường Y Dược lớn (Hà Nội, Huế, Đà Nẵng, TP. Hồ Chí Minh, Cần Thơ). Lực lượng này thường xuyên phải xử lý dữ liệu y sinh để làm luận văn tốt nghiệp, công bố bài báo khoa học và có nhu cầu tận dụng thời gian ngoài giờ để đọc bản ghi chuyên môn.
- Điều tra Tệp 4 (Khoảng trống trang thiết bị tuyến cơ sở và dữ liệu thần kinh): Báo cáo của Bộ Y tế và Hội Đột quỵ Việt Nam chỉ ra toàn quốc hiện mới thành lập được hơn 130 trung tâm và đơn vị đột quỵ trên tổng số hơn 1.500 bệnh viện công lập và tư nhân. Các cơ sở y tế tuyến huyện, tuyến tỉnh và phòng khám tư thiếu cả máy điện não gọn nhẹ lẫn bác sĩ chuyên khoa đọc kết quả trực đêm. Ngoài ra, các nhóm nghiên cứu giao diện não - máy tính (BCI) và thử nghiệm lâm sàng thuốc thần kinh đang thiếu các tập dữ liệu sóng não đo tự nhiên nhiều đêm liên tục ngoài môi trường phòng bệnh.
- Khảo sát kiểm chứng trực tiếp của nhóm dự án: Song song với số liệu thống kê ngành, nhóm xây dựng biểu mẫu khảo sát thực địa hai luồng (neurolink_market_survey.html) hướng tới quy mô mẫu 100 đến 150 người đi làm xa quê và các bác sĩ trẻ tại Đà Nẵng - Huế để kiểm tra chéo thói quen sử dụng, rào cản đeo thiết bị khi ngủ và mức chi phí hợp lý trước khi sản xuất lô thử nghiệm.

c. Phản biện câu hỏi kiểm tra tính logic:
Câu hỏi chất vấn: Phục vụ cả phòng Lab đại học, người mất ngủ lẫn bác sĩ trên cùng một mô hình liệu có làm nhóm kỹ thuật bị quá tải không?
Giải trình logic: Ba nhóm này không tách thành ba sản phẩm rời rạc mà sử dụng chung một lõi kỹ thuật duy nhất. Mạch thu nhận tín hiệu ADS1299 và thuật toán trích xuất đặc trưng trên Web đều là một; điểm khác nhau chỉ nằm ở quyền truy cập giao diện: phòng Lab cần xuất dữ liệu sóng thô (CSV/API), người dùng gia đình chỉ nhận thông báo tóm tắt giấc ngủ dễ hiểu trên điện thoại, còn bác sĩ nhìn thấy bản đồ phổ tần số 19 kênh đã lọc nhiễu để đánh giá và gán nhãn.

2. Giải pháp Giá trị (Value Propositions)

a. Nội dung cô đọng đưa lên bảng BMC:
- Cho Gia đình và Người rối loạn giấc ngủ: Vòng đeo vùng tai gọn nhẹ, tự đo khi ngủ (0 thao tác phức tạp); tự học đường nền sóng não 7 đêm đầu và gọi báo động cho con cái ở xa khi phát hiện lệch pha bất thường.
- Cho Phòng Lab ĐH và Cơ sở Trị liệu Giấc ngủ: Bộ Kit đo sóng não 8 kênh 24-bit kèm phần mềm tiếng Việt và API mở với chi phí thấp hơn nhiều so với nhập ngoại; xuất báo cáo định lượng chỉ số thư giãn trước - sau buổi trị liệu.
- Cho Bác sĩ Trẻ và Nhà nghiên cứu: Miễn phí trạm lọc nhiễu, dựng bản đồ não 19 kênh phục vụ nghiên cứu (chuẩn Research-Use-Only); gán nhãn sóng não nhận tín chỉ (Credit) đổi bộ dữ liệu luận văn và nhận thù lao khi đọc ca tư vấn ngoài giờ.
- Cho Tuyến Y tế Cơ sở và Đơn vị Nghiên cứu (Giai đoạn 2): Hỗ trợ sàng lọc bất đối xứng bán cầu não từ xa (kèm rào chắn an toàn tPA) sau khi hoàn tất cấp phép; cung cấp bộ dữ liệu sóng não dài ngày đã khử định danh.

b. Phân tích tính thuyết phục về mặt kỹ thuật và sử dụng:
Khác với đồng hồ thông minh ở cổ tay chỉ đo gián tiếp nhịp tim bằng cảm biến quang học (PPG) vốn dễ sai lệch khi gập tay và phản ánh chậm biến đổi thần kinh trung ương, NeuroLink thu trực tiếp điện thế hoạt động vỏ não qua cụm điện cực khô vùng tai. Hệ thống theo dõi tỷ lệ sóng chậm (DAR, TAR) và độ bất đối xứng giữa hai bán cầu não (BSI) xuyên suốt các chu kỳ ngủ sâu.

Đối với giới nghiên cứu và bác sĩ trẻ, việc xử lý nhiễu điện lưới 50Hz, nhiễu nháy mắt và dựng bản đồ nội suy không gian tốn rất nhiều công sức lập trình. NeuroLink đóng gói sẵn toàn bộ quy trình này trên giao diện trình duyệt miễn phí (dưới nhãn phục vụ nghiên cứu - Research-Use-Only để tuân thủ đúng pháp luật khi chưa đăng ký chẩn đoán lâm sàng), biến công cụ thành trợ lý đắc lực thu hút giới chuyên môn tham gia hệ sinh thái.

c. Phản biện câu hỏi kiểm tra tính logic:
Câu hỏi chất vấn: Khi ngủ sâu bình thường não người cũng sinh ra sóng chậm Delta, làm sao máy không báo động nhầm lúc nửa đêm?
Giải trình logic: Sóng chậm Delta của giấc ngủ sâu sinh lý (pha N3) có đặc trưng đối xứng đồng bộ trên cả hai bán cầu não. Ngược lại, hiện tượng thiếu máu cục bộ hoặc rối loạn vỏ não khu trú gây ra sự chênh lệch bất đối xứng rõ rệt về công suất phổ và pha giữa bán cầu trái và bán cầu phải (đo qua chỉ số BSI và wPLI) so với chính đường nền 7 đêm đầu của người đó. Hệ thống dựa trên độ lệch đối xứng cá nhân hóa thay vì chỉ đếm biên độ sóng chậm đơn thuần.

3. Kênh Tiếp cận theo Lộ trình Tuân thủ Pháp lý (Channels)

a. Nội dung cô đọng đưa lên bảng BMC:
- Giai đoạn 1 (0-12 tháng - Không vướng phép khám chữa bệnh): Cung cấp trực tiếp bộ Kit cho các khoa Kỹ thuật - Y sinh và cơ sở trị liệu giấc ngủ; phân phối thiết bị theo dõi giấc ngủ qua Website và cộng đồng trực tuyến.
- Giai đoạn 2 (12-24 tháng - Sau thử nghiệm Sandbox và cấp phép): Phối hợp phòng khám chuyên khoa thần kinh cho bệnh nhân mượn hoặc thuê đo theo dõi ngắn hạn 3-5 đêm tại nhà và mở rộng sang chuỗi nhà thuốc.
- Giai đoạn 3 (Trên 24 tháng): Cổng chia sẻ và cấp phép bộ dữ liệu nghiên cứu (Data Bank) trực tuyến cho các viện thần kinh và đơn vị phát triển y sinh.

b. Phân tích tính hợp lý của lộ trình triển khai:
Lộ trình ba giai đoạn giải quyết triệt để mâu thuẫn giữa tốc độ ra mắt sản phẩm công nghệ và thời gian kiểm định y tế. Ở Giai đoạn 1, nhóm không đưa máy vào nhà thuốc hay phòng khám kê đơn vì chưa có Số lưu hành Trang thiết bị Y tế. Thay vào đó, việc cung cấp bộ Kit thực hành nghiên cứu cho các phòng Lab đại học và bán thiết bị hỗ trợ theo dõi giấc ngủ trực tuyến là hoàn toàn hợp pháp và vừa sức với nguồn lực của một nhóm phát triển xuất phát từ trường kỹ thuật.

Khi bước sang Giai đoạn 2 (sau khi đã có kết quả đo đối chứng tại bệnh viện và chứng nhận lưu hành), kênh phòng khám chuyên khoa sẽ vận hành theo hình thức đo ngắn hạn 3 đến 5 đêm tại nhà tương tự như dịch vụ đeo máy Holter điện tim 24 giờ hiện hành, giúp bệnh nhân dễ dàng tiếp cận mà không phải mua đứt thiết bị đắt tiền.

c. Phản biện câu hỏi kiểm tra tính logic:
Câu hỏi chất vấn: Làm sao thu hút được các phòng Lab và bác sĩ biết đến nền tảng khi nhóm không có nhiều tiền quảng cáo?
Giải trình logic: Kênh lan tỏa tự nhiên nằm ở chính công cụ Web qEEG miễn phí cho nghiên cứu. Khi sinh viên y sinh, học viên cao học và giảng viên tại các trường đại học dùng phần mềm để phân tích sóng não và trích dẫn nền tảng trong các báo cáo khoa học, uy tín học thuật sẽ tự động kéo theo nhu cầu đặt mua phần cứng Bộ Kit đồng bộ cho phòng thí nghiệm.

4. Quan hệ và Cơ chế Giữ chân Người dùng (Customer Relationships)

a. Nội dung cô đọng đưa lên bảng BMC:
- Cộng sinh cùng Bác sĩ và Nhà nghiên cứu: Xác thực CCHN/ORCID dùng miễn phí công cụ qEEG; gán nhãn ca sạch nhiễu (kiểm tra đồng thuận 2 người) để tích Credit tải dữ liệu Data Bank và ưu tiên nhận ca tư vấn.
- Duy trì thói quen đeo máy ở người lớn tuổi: AI hiệu chuẩn theo não từng người trong 7 đêm đầu; báo cáo sáng gửi điện thoại các con để con cái chủ động hỏi thăm, nhắc cha mẹ đeo đều đặn.
- Hỗ trợ chuyên môn khi cần: Khi có chỉ số bất thường, gia đình gửi yêu cầu trên ứng dụng để bác sĩ xem bản ghi đã lọc nhiễu và giải thích định hướng từ xa.

b. Phân tích tính chặt chẽ của vòng lặp giữ chân:
Thách thức lớn nhất của thiết bị đeo sức khỏe là người dùng dễ bỏ quên sau vài tuần đầu (tỷ lệ bỏ cuộc ngoài thị trường thường chiếm 60% đến 80%), còn thách thức của AI y tế là thiếu bác sĩ gán nhãn dữ liệu. Khối Quan hệ khách hàng giải quyết cả hai bài toán bằng cơ chế khóa chéo:
- Thứ nhất, đối với bác sĩ và nhà nghiên cứu: Hệ thống không mở miễn phí một chiều mà áp dụng nguyên tắc trao đổi công bằng đã được lập trình sẵn trong cơ sở dữ liệu (CreditWallet và NeuralTrainingSample). Để tránh tình trạng người dùng bấm chọn nhãn đại khái nhằm lấy điểm (spam nhãn), hệ thống chỉ cộng Credit khi bản ghi đạt độ sạch tín hiệu trên 0,80 và có kết quả gán nhãn trùng khớp giữa ít nhất hai người đọc độc lập (đồng thuận mù 2 chuyên gia) cùng các mẫu chuẩn vàng kiểm tra ngầm.
- Thứ hai, đối với hộ gia đình: Thói quen sử dụng không đặt lên vai người già hay quên, mà đặt vào tình cảm và trách nhiệm của người con nhận bản tin sáng mỗi ngày trên điện thoại, kết hợp với hồ sơ đường chuẩn sóng não cá nhân hóa tích lũy theo thời gian.

c. Phản biện câu hỏi kiểm tra tính logic:
Câu hỏi chất vấn: Nếu bác sĩ trên ứng dụng tư vấn sai dẫn đến rủi ro y khoa cho người dùng ở nhà thì sao?
Giải trình logic: Phần mềm khóa chặt cấu trúc phản hồi thành ba mục tách biệt (nhận xét hình thái sóng khách quan, giải thích kiến thức tham khảo và khuyến nghị đi khám chuyên khoa), hoàn toàn không cho phép kê đơn thuốc trên mạng. Đồng thời, nếu thuật toán phát hiện độ lệch bán cầu vượt ngưỡng nguy hiểm cấp tính, màn hình tự động bật cảnh báo đỏ hướng dẫn gia đình gọi cấp cứu 115 đưa đến bệnh viện chụp CT ngay lập tức thay vì ngồi chờ tư vấn trực tuyến.

5. Dòng Doanh thu Tự Duy trì (Revenue Streams)

a. Nội dung cô đọng đưa lên bảng BMC:
- (1) Cung cấp Bộ Kit Nghiên cứu và Phần mềm: Bán bộ Kit đo sóng não 8 kênh cho phòng Lab đại học (thấp hơn nhiều so với nhập ngoại) và phí thuê bao phần mềm xuất báo cáo cho cơ sở trị liệu giấc ngủ.
- (2) Thiết bị Đeo Theo dõi Giấc ngủ Cá nhân: Thu từ bán thiết bị đeo ngủ cho hộ gia đình hoặc hình thức đặt cọc mượn máy dùng thử (mức cọc bảo đảm bằng hoặc lớn hơn giá linh kiện để không hụt vốn).
- (3) Duy trì Phần mềm AI, Đệm Điện cực và Phí Kết nối: Phí duy trì tài khoản cảnh báo gia đình hàng tháng nhẹ nhàng, bán hộp đệm điện cực thay thế định kỳ để giữ độ dẫn điện tốt và thu một phần nhỏ phí vận hành trên mỗi ca tư vấn bác sĩ.
- (4) Cấp phép Bộ Dữ liệu Nghiên cứu (Giai đoạn 3): Phí cấp phép truy cập các tập dữ liệu sóng não dài ngày đã khử sạch định danh cho các đơn vị nghiên cứu thần kinh - dược phẩm.

b. Phân tích tính hợp lý và khả năng tự nuôi sống dự án:
Thay vì đặt ra các mức giá cao bất hợp lý hay kỳ vọng lợi nhuận đột biến, cấu trúc nguồn thu được phân bổ để dự án kỹ thuật có thể tự trang trải chi phí ở quy mô nhỏ ngay từ đầu:
- Khoản thu từ Bộ Kit nghiên cứu và thiết bị đeo cá nhân giúp thu hồi ngay vốn linh kiện sản xuất lô tiếp theo mà không bị đọng vốn.
- Khoản phí duy trì tài khoản hàng tháng được giữ ở mức phổ thông vì hệ thống xử lý hoàn toàn tự động bằng thuật toán trên máy chủ, không gộp chi phí bác sĩ vào gói tháng. Chỉ khi nào gia đình có nhu cầu nhờ bác sĩ xem chuyên sâu từng bản ghi bất thường thì mới thanh toán theo lượt đó (phần lớn thù lao chuyển thẳng cho bác sĩ đọc ca, hệ thống chỉ giữ lại phần nhỏ bù đắp hạ tầng).

c. Phản biện câu hỏi kiểm tra tính logic:
Câu hỏi chất vấn: Vì sao người dùng phải thay đệm điện cực định kỳ mà không dùng vĩnh viễn một cặp điện cực kim loại?
Giải trình logic: Đây là yêu cầu vật lý sinh học thực tế. Mồ hôi và dầu tự nhiên trên da vùng tai lâu ngày sẽ làm tăng trở kháng tiếp xúc bề mặt (vượt quá ngưỡng an toàn 10 đến 20 kOhm), gây nhiễu đường nền làm giảm độ chính xác của sóng não microvolt. Việc thiết kế đệm dẫn điện dạng khớp tháo lắp thay mới sau mỗi vài tháng vừa đảm bảo vệ sinh da cho người lớn tuổi, vừa giữ chất lượng tín hiệu luôn ổn định như ban đầu.

6. Tài sản và Nguồn lực Cốt lõi (Key Resources)

a. Nội dung cô đọng đưa lên bảng BMC:
- Chống Ăn cắp Mô hình và Nhái Mạch: Trọng số AI và rào chắn an toàn CM[2,1]=0 chạy kín trên Cloud Server (không lưu trên thiết bị); khóa Flash MCU APPROTECT kết hợp xác thực thiết bị Device Certificate chặn bo mạch sao chép kết nối hệ thống.
- Hào lũy Dữ liệu Đồng thuận Kép: Kho dữ liệu sóng não người Việt NeuralTrainingSample gán nhãn mù độc lập bởi 2 bác sĩ có CCHN đổi tín chỉ Credit; lịch sử đường nền cá nhân hóa 3 đến 6 tháng gắn chặt với người dùng.
- Định vị Né Cá lớn (Judo Strategy): Mở SDK Python chiếm lĩnh hơn 65 khoa Kỹ thuật - Y sinh và 40 trường Y Dược (thay thế OpenBCI và Emotiv đắt đỏ); lấp đầy khoảng trống kết nối bác sĩ thần kinh nội địa mà Smartwatch PPG hay đai ngủ ngoại (Muse/Frenz) bỏ trống.
- Tài sản Đã Kiểm chứng: Bo mạch 6 lớp ADS1299 đạt 0 lỗi DRC (hệ số tương quan mô phỏng r = 0,99396), mô hình AI ngoại kiểm mù UCLH London N=28 đạt BAcc 73,33% (và 67,22% ở điều kiện Zero-Calibration sau đợt kiểm toán Round 2), bằng Giải pháp hữu ích điện cực khô vùng tai và rào cản pháp lý Sandbox Nghị quyết 136/2024/QH15.

b. Phân tích giá trị cốt lõi về mặt công nghệ:
Điểm tựa kỹ thuật cốt lõi của NeuroLink dựa trên kiến trúc bảo vệ đa tầng kết hợp chặt chẽ giữa phần cứng và điện toán đám mây. Mạch in 6 lớp ADS1299 sử dụng kỹ thuật đường bao bảo vệ (guard-ring) và phân tách mặt phẳng đất AGND/DGND nghiêm ngặt để triệt tiêu nhiễu ký sinh vi mô, đạt hệ số nén tín hiệu đồng pha CMRR vượt trội (hệ số tương quan tín hiệu mô phỏng r = 0,99396).

Về bảo mật giải thuật, toàn bộ 80 đặc trưng bất biến độ lợi, mô hình học đường nền cá nhân 7 đêm và tầng veto an toàn cấp 3 (Stage 3 Safety Veto) được giấu kín hoàn toàn trên máy chủ đám mây. Vi điều khiển nRF52 trên thiết bị đeo chỉ thực thi các tác vụ lọc nhân quả cơ bản (bộ lọc khuyết Notch 50Hz, dải thông Bandpass 0.5-40Hz), kiểm tra tiếp xúc điện cực lead-off và mã hóa đường truyền Bluetooth Low Energy. Việc sao chép phần cứng hay trích xuất bộ nhớ vi điều khiển hoàn toàn không thể thu thập được trọng số mô hình AI hay giải thuật phân tích chuyên sâu.

Đồng thời, dự án xây dựng hào lũy dữ liệu độc quyền thông qua cơ chế đồng thuận kép (2-Reader Blind Consensus). Mỗi bản ghi điện não trước khi đưa vào kho dữ liệu NeuralTrainingSample bắt buộc phải được thẩm định độc lập bởi hai bác sĩ có CCHN. Dữ liệu thực nghiệm của người Việt với nhãn chuẩn y khoa là tài nguyên mà các đối thủ nước ngoài không thể sở hữu trong ngắn hạn.

c. Phản biện câu hỏi kiểm tra tính logic:
Câu hỏi chất vấn: Nếu các xưởng điện tử Thẩm Quyến sao chép nguyên mẫu bo mạch và bán giá rẻ trên các sàn thương mại điện tử thì startup có bị bóp nghẹt không?
Giải trình logic: Việc sao chép phần cứng chỉ tạo ra một bo mạch trần vô tri. NeuroLink áp dụng cơ chế xác thực chứng chỉ số phần cứng (Device Certificate) được ký điện tử tại xưởng EMS và khóa cổng nạp Flash bằng tính năng APPROTECT của chip nRF52. Bo mạch trôi nổi không có chứng chỉ xác thực sẽ bị máy chủ từ chối kết nối API, không thể sử dụng Trạm Web qEEG cũng như ứng dụng gia đình. Khách hàng mua thiết bị để nhận phân tích và cảnh báo chứ không mua một tấm mạch điện tử rời.

7. Hoạt động Trọng yếu (Key Activities)

a. Nội dung cô đọng đưa lên bảng BMC:
- Tối ưu Mạch đo, Điện cực khô và Lọc nhiễu: Hoàn thiện kiểu dáng công thái học đeo vùng tai, firmware BLE tiết kiệm năng lượng và bộ lọc khử nhiễu chuyển động, nhiễu điện lưới 50Hz thời gian thực.
- Vận hành Trạm qEEG và Học đường nền: Duy trì hệ thống phân tích tự động, học đường chuẩn 7 đêm đầu của từng cá nhân và kiểm soát quy trình đồng thuận nhãn dữ liệu từ bác sĩ.
- Đo đối chứng lâm sàng và Pháp lý: Phối hợp đo song song với máy điện não tiêu chuẩn tại bệnh viện dưới sự giám sát của Hội đồng Đạo đức để hoàn thiện hồ sơ xin cấp phép lưu hành.

b. Phân tích tính khả thi đối với nhóm thực hiện:
Nhóm dự án không tự đầu tư máy móc cơ khí hay dây chuyền hàn mạch tốn kém mà áp dụng phương thức thiết kế và kiểm chuẩn tập trung (Fabless). Khâu sản xuất phôi mạch và gắn linh kiện bề mặt (SMT) được đặt hàng tại các xưởng gia công điện tử chuyên nghiệp đạt chuẩn ISO 13485 trong nước. Nhóm kỹ thuật tập trung toàn bộ thời gian vào ba việc cốt lõi đúng chuyên môn đào tạo: tối ưu chất lượng thu nhận tín hiệu sinh học, nâng cấp thuật toán học máy chống nhiễu giả và tổ chức đo kiểm đối chứng thực tế.

c. Phản biện câu hỏi kiểm tra tính logic:
Câu hỏi chất vấn: Rào cản kỹ thuật khó nhất khi chuyển từ mạch đo phòng thí nghiệm sang vòng đeo ngủ vùng tai cho người già là gì và nhóm xử lý thế nào?
Giải trình logic: Khó khăn lớn nhất là nhiễu chuyển động khi người ngủ xoay đầu đè lên gối làm xê dịch điện cực khô. Nhóm giải quyết trên cả hai tầng: tầng vật lý dùng chất liệu đàn hồi y tế ôm sát hõm tai kết hợp mạch tự động đo trở kháng tiếp xúc liên tục (Lead-off / Impedance check có sẵn trên chip ADS1299); tầng phần mềm dùng bộ đánh giá chất lượng tín hiệu tự động (Signal Quality Index - SQI) cắt bỏ các đoạn cửa sổ 4 giây bị nhiễu cơ do nghiến răng hoặc trở mình trước khi đưa vào thuật toán tính đối xứng bán cầu, tránh phát sinh báo động giả.

8. Đối tác Chính (Key Partners)

a. Nội dung cô đọng đưa lên bảng BMC:
- Khối Học thuật và Chăm sóc Giấc ngủ: Các phòng Lab Kỹ thuật - Y sinh tại các trường đại học (ĐH Bách Khoa, khối trường Y Dược) và các trung tâm tâm lý, cơ sở nghỉ dưỡng phục hồi tại Đà Nẵng - Hội An.
- Đầu mối Chính sách và Ươm tạo: Trung tâm Hỗ trợ Khởi nghiệp Đổi mới Sáng tạo Đà Nẵng (DISSC - Sở KH&CN) và Vườn ươm Doanh nghiệp Đà Nẵng (DNES).
- Đối tác Chuyên môn và Đo đối chứng: Hội Thầy thuốc Trẻ Đà Nẵng và các khoa chuyên môn tại Bệnh viện Đà Nẵng.
- Đối tác Gia công: Đơn vị gia công mạch điện tử EMS đạt chứng nhận quản lý chất lượng thiết bị y tế ISO 13485.

b. Phân tích động lực hợp tác thực tế của từng đối tác:
Mối quan hệ hợp tác chỉ bền vững khi mang lại lợi ích thiết thực cho cả hai phía:
- Các phòng Lab đại học có được thiết bị thu thập sóng não mở phục vụ giảng dạy đồ án và công bố khoa học với chi phí hợp lý và hỗ trợ kỹ thuật trực tiếp trong nước.
- Hội Thầy thuốc Trẻ và các bác sĩ tại bệnh viện có thêm nguồn dữ liệu số hóa và công cụ phần mềm tự động phục vụ các đề tài nghiên cứu khoa học cấp cơ sở, cấp thành phố mà không tốn công xử lý tín hiệu thủ công.
- Trung tâm DISSC và Vườn ươm DNES thực hiện đúng chức năng hỗ trợ các dự án công nghệ cao xuất phát từ đại học địa phương tiếp cận hành lang thử nghiệm Sandbox Nghị quyết 136/2024/QH15.

c. Phản biện câu hỏi kiểm tra tính logic:
Câu hỏi chất vấn: Làm sao thuyết phục bệnh viện đồng ý cho đo đối chứng trên bệnh nhân thực tế?
Giải trình logic: Dự án không tự ý mang thiết bị vào đo thương mại, mà đi theo con đường đề tài nghiên cứu khoa học phối hợp cùng các bác sĩ chuyên khoa thần kinh dưới sự xét duyệt của Hội đồng Đạo đức trong nghiên cứu y sinh học. Việc đo kiểm hoàn toàn không xâm lấn, thực hiện miễn phí trên người tình nguyện có ký phiếu đồng thuận và không can thiệp vào phác đồ điều trị hiện hành của bệnh viện.

9. Cấu trúc Chi phí (Cost Structure)

a. Nội dung cô đọng đưa lên bảng BMC:
- Linh kiện và Gia công phần cứng: Chi phí chip đo sinh học AFE, vi điều khiển BLE, pin an toàn, điện cực khô mạ vàng và phí thuê gia công SMT theo từng lô đặt hàng (không chôn vốn xây xưởng).
- Hạ tầng Máy chủ và Lưu trữ: Chi phí vận hành máy chủ xử lý tín hiệu đám mây, cơ sở dữ liệu chuỗi thời gian bảo mật và dịch vụ gửi cảnh báo tự động (tăng tuyến tính theo lượng người dùng thực tế).
- Thù lao Bác sĩ và Thu thập Nhãn AI: Không tốn chi phí lương cứng cố định hàng tháng (chỉ chia sẻ thù lao khi có ca tư vấn phát sinh); chi phí tiền mặt mua nhãn huấn luyện bằng 0 nhờ cơ chế đổi tín chỉ nội bộ.
- Đo đối chứng và Hồ sơ Pháp lý: Kinh phí kiểm tra an toàn điện sinh học IEC 60601-1, thử nghiệm đối chứng tại viện và lập hồ sơ đăng ký lưu hành.

b. Phân tích tính an toàn tài chính khi vận hành nhỏ gọn:
Cấu trúc chi phí được thiết kế tối giản tối đa các khoản chi cố định hàng tháng để phù hợp với xuất phát điểm của một dự án công nghệ khởi nguồn từ đại học. Ba khoản chi thường làm các dự án y tế số cạn vốn sớm nhất gồm chi phí xây xưởng sản xuất, lương tháng cố định cho đội ngũ bác sĩ trực và chi phí mua dữ liệu huấn luyện đều đã được chuyển hóa hoàn toàn thành chi phí biến đổi hoặc cơ chế trao đổi tín chỉ cộng sinh. Nhờ vậy, khi số lượng người dùng ban đầu còn ít, chi phí duy trì hệ thống rất thấp và không gây áp lực tài chính.

c. Phản biện câu hỏi kiểm tra tính logic:
Câu hỏi chất vấn: Chip đo điện não chuyên dụng như ADS1299 có giá linh kiện khá cao khi mua lẻ, làm sao tối ưu giá thành cho phiên bản đeo ngủ gia đình?
Giải trình logic: Dự án phân tách cấu hình linh kiện hợp lý theo đúng mục đích kỹ thuật: phiên bản Bộ Kit nghiên cứu 8 kênh cho phòng Lab giữ nguyên chip TI ADS1299 8 kênh độ phân giải cao vì khách hàng tổ chức ưu tiên độ chi tiết đa kênh; trong khi phiên bản vòng đeo ngủ vùng tai cho hộ gia đình chỉ cần thu gọn 2 đến 4 kênh đối xứng hai bên thái dương - tai nên sử dụng dòng chip AFE ít kênh hơn hoặc mạch khuếch đại đo lường sinh học chuyên biệt kết hợp ADC 24-bit tiêu thụ dòng siêu thấp, giúp giảm mạnh giá thành linh kiện mà vẫn giữ nguyên độ tin cậy phát hiện bất đối xứng.

10. Chân bảng: Tính Bền vững và Hành lang Pháp lý tại Đà Nẵng

a. Nội dung cô đọng đưa lên bảng BMC:
- Lộ trình 2 Bước Đúng Luật: Giai đoạn 1 cung cấp hợp pháp Bộ Kit nghiên cứu và Thiết bị hỗ trợ theo dõi giấc ngủ thông thường (tuân thủ Nghị định 98/2021/NĐ-CP và 07/2023/NĐ-CP, không quảng cáo chẩn đoán bệnh) -> Giai đoạn 2 hoàn tất kiểm định lâm sàng để mở khóa tính năng cảnh báo y tế.
- Hành lang Chính sách Đà Nẵng: Tận dụng cơ chế thử nghiệm có kiểm soát (Sandbox) theo Nghị quyết 136/2024/QH15 của Quốc hội và chính sách hỗ trợ dự án khởi nghiệp sáng tạo theo Nghị quyết 19/2026/NQ-HĐND thành phố Đà Nẵng thông qua Sở Khoa học và Công nghệ.

b. Phân tích ý nghĩa bảo vệ dự án:
Việc đặt Chân bảng pháp lý làm nền đỡ cho toàn bộ 9 khối phía trên chứng minh dự án hiểu rõ ranh giới nghiêm ngặt giữa thiết bị điện tử chăm sóc sức khỏe (Wellness) và trang thiết bị y tế (Medical Device). Tuân thủ lộ trình hai bước giúp sản phẩm vừa được phép đưa ra thực tế sớm để thu nhận phản hồi người dùng, vừa tận dụng được lợi thế địa phương của Đà Nẵng (cơ chế Sandbox công nghệ mới theo Nghị quyết 136/2024/QH15) để đi trọn con đường kiểm chứng khoa học chính quy.

c. Phản biện câu hỏi kiểm tra tính logic:
Câu hỏi chất vấn: Làm sao bảo vệ quyền riêng tư đối với dữ liệu sóng não của người dùng?
Giải trình logic: Ngay từ tầng cơ sở dữ liệu (đã lập trình trong bảng NeuralTrainingSample), mọi bản ghi đưa vào kho nghiên cứu hoặc gửi lên hàng đợi nhờ bác sĩ đọc đều bắt buộc tách rời hoàn toàn thông tin định danh cá nhân (tên, số điện thoại, địa chỉ), chỉ lưu mã băm ẩn danh và chỉ được phép chia sẻ khi người sở hữu dữ liệu chủ động bật quyền đồng thuận (Data Consent) trên ứng dụng.

III. PHÂN TÍCH ĐỐI THỦ CẠNH TRANH, HÀO LŨY PHÒNG THỦ VÀ CƠ CHẾ CHỐNG SAO CHÉP

1. Bản đồ 4 nhóm đối thủ cạnh tranh và khoảng trống tại Việt Nam

Nhóm phát triển khẳng định nguyên tắc phân tích kỹ thuật: Dự án tuyệt đối không tự nhận không có đối thủ cạnh tranh. Mọi giải pháp công nghệ trên thị trường đều chịu sự cạnh tranh trực tiếp hoặc gián tiếp từ các thiết bị hiện hành. Việc đánh giá năng lực cạnh tranh được xây dựng dựa trên sự phân rã véc-tơ tấn công kỹ thuật, ranh giới vật lý của cảm biến, chi phí vận hành biên và rào cản pháp lý tại thị trường Việt Nam.

a. Vòng 1: Thiết bị EEG lâm sàng bệnh viện và cấp cứu
- Đại diện tiêu biểu: Ceribell Rapid Response EEG (Mỹ), BrainScope (Mỹ), hệ thống máy điện não tĩnh 32-64 kênh chuyên dụng phòng Lab (Nihon Kohden EEG-1200, Natus Quantum/Xltek).
- Đặc tính kỹ thuật:
  + Ceribell sử dụng dải đai 10 điện cực dán một lần qua trán và thái dương (thu được 8 kênh vi sai), đầu đọc bỏ túi kèm màn hình hiển thị, thuật toán Clarity phát hiện trạng thái động kinh không co giật (NCSE), chuyển đổi sóng não thành âm thanh (Brain Stethoscope), đã được FDA 510(k) phê duyệt và nhận cơ chế thanh toán gia tăng CMS NTAP tại Mỹ.
  + Nihon Kohden và Natus vận hành 32 đến 64 kênh chuẩn 10-20, tốc độ lấy mẫu từ 1.000 Hz đến 10.000 Hz, ADC 24-bit, sử dụng mũ đo gel ướt hoặc gắn điện cực bằng keo dẫn điện Collodion.
- Điểm nghẽn vận hành và rào cản tiếp cận:
  + Chi phí đầu tư thiết bị rất cao: Hệ thống máy điện não chuyên dụng Nihon Kohden hoặc Natus có giá từ 500 triệu đến hơn 1,2 tỷ VNĐ (tương đương 20.000 đến 50.000 USD). Đai dán Ceribell là vật tư tiêu hao dùng một lần có giá hàng trăm USD cho mỗi ca đo, bán kèm hợp đồng dịch vụ bệnh viện định kỳ.
  + Quy trình thao tác phức tạp: Việc gắn mũ điện não 19 đến 32 kênh gel ướt đòi hỏi kỹ thuật viên điện thần kinh chuyên trách thực hiện đo đạc, chà da giảm trở kháng xuống dưới 5 kOhm trong thời gian từ 30 đến 45 phút. Quy trình này không thể triển khai tại phòng khám tuyến huyện, trạm y tế cơ sở lúc nửa đêm hoặc tại nhà riêng của người bệnh.
- Khoảng trống thị trường cho NeuroLink: Dự án không đối đầu trực diện trong phòng hồi sức tích cực (ICU) của các bệnh viện tuyến trung ương. NeuroLink tập trung giải quyết bài toán theo dõi dài hạn ban đêm tại hộ gia đình bằng đai đeo vùng tai gọn nhẹ và cung cấp bộ Kit 8 kênh giá thấp cho các phòng thực hành nghiên cứu chưa có kinh phí trang bị máy lâm sàng đắt tiền.


b. Vòng 2: Thiết bị kit nghiên cứu và đào tạo đại học
- Đại diện tiêu biểu: OpenBCI Cyton 8 kênh (Mỹ), Emotiv EPOC X và Insight (Mỹ/Úc), Bitbrain Versatile (Tây Ban Nha).
- Đặc tính kỹ thuật:
  + OpenBCI Cyton 8 kênh sử dụng chip TI ADS1299 kết hợp vi điều khiển PIC32MX, truyền dữ liệu không dây qua bộ thu phát USB Dongle RF 2.4 GHz, mã nguồn mở phần cứng và phần mềm, hỗ trợ truyền luồng dữ liệu thô qua giao thức Lab Streaming Layer (LSL) và thư viện BrainFlow.
  + Emotiv EPOC X trang bị 14 điện cực nỉ tẩm nước muối sinh lý (saline), truyền thông Bluetooth không dây.
- Điểm nghẽn vận hành và rào cản tiếp cận:
  + Rào cản chi phí mua sắm: Bo mạch OpenBCI Cyton 8 kênh có giá bán niêm yết 1.249 USD (khoảng 32 triệu VNĐ), khi mua trọn bộ khung mũ Ultracortex Mark IV chi phí vượt quá 2.100 USD (hơn 54 triệu VNĐ). Đây là rào cản rất lớn đối với ngân sách đề tài sinh viên (thường ở mức 10 đến 30 triệu VNĐ) hoặc đề tài cấp cơ sở tại các trường đại học Việt Nam. Thủ tục hải quan nhập khẩu trang thiết bị đo sinh học kéo dài từ 4 đến 8 tuần và không có đơn vị bảo hành, hỗ trợ kỹ thuật tại chỗ.
  + Rào cản thu phí dữ liệu thô (Paywall): Emotiv bán phần cứng EPOC X ở mức giá 849 đến 999 USD, nhưng khóa chặt toàn bộ luồng dữ liệu thô (raw EEG). Người nghiên cứu muốn trích xuất dữ liệu dạng CSV hoặc kết nối API thời gian thực để chạy thuật toán bắt buộc phải trả phí thuê bao phần mềm EmotivPRO hàng tháng hoặc hàng năm với chi phí định kỳ đắt đỏ.
- Khoảng trống thị trường cho NeuroLink: Cung cấp bo mạch phần cứng 8 kênh ADS1299 nội địa hóa với chi phí chế tạo thực tế chỉ bằng một phần tư OpenBCI, tích hợp sẵn API kết nối Python/LSL mở hoàn toàn và trạm Web qEEG tiếng Việt, loại bỏ hoàn toàn các rào cản thu phí thuê bao xuất dữ liệu thô.


c. Vòng 3: Thiết bị đeo theo dõi giấc ngủ tiêu dùng
- Đại diện tiêu biểu: Frenz Brainband của Earable Neuroscience (GS. Vũ Ngọc Tâm sáng lập, có văn phòng tại Mỹ và Việt Nam), Muse S (Interaxon, Canada), NextSense (Mỹ).
- Đặc tính kỹ thuật:
  + Frenz Brainband có giá bán lẻ khoảng 680 USD (tương đương 17 triệu VNĐ), thiết kế dạng băng đô ôm trán và vòng qua tai. Thiết bị tích hợp 7 cảm biến gồm điện cực khô mạ vàng đo EEG, EOG, EMG, cảm biến quang học PPG đo nồng độ oxy trong máu SpO2, nhịp tim và gia tốc kế đo chuyển động đầu. Hệ thống sử dụng loa truyền dẫn qua xương (bone conduction) phát âm thanh kích thích (pink noise, binaural beats, liệu pháp CBT-i) để dẫn dắt người dùng vào giấc ngủ.
  + Muse S có giá bán 399 USD kèm phí phần mềm 12,99 USD/tháng, trang bị 4 kênh EEG (2 trán, 2 sau tai), PPG và cảm biến chuyển động phục vụ thiền định và theo dõi chu kỳ ngủ.
- Điểm nghẽn vận hành và rào cản tiếp cận:
  + Ranh giới phân định thiết bị tiêu dùng (Wellness): Frenz Brainband và Muse S được định vị là sản phẩm phong cách sống và thư giãn giấc ngủ cá nhân cho đối tượng có thu nhập cao. Thiết bị tập trung vào vòng lặp âm thanh ru ngủ, không có cấu hình phân tích bệnh lý thần kinh, không tính toán chỉ số bất đối xứng bán cầu (BSI), không có mô hình phân loại đột quỵ và không tích hợp rào chắn an toàn tiêu sợi huyết CM[2,1]=0.
  + Thiếu sự kết nối chuyên môn y tế: Cả Frenz và Muse vận hành theo mô hình ứng dụng di động độc lập. Người dùng chỉ xem được điểm số giấc ngủ tổng hợp, hoàn toàn không có cơ chế chuyển giao dữ liệu sóng não đã khử nhiễu tới các bác sĩ chuyên khoa thần kinh có chứng chỉ hành nghề tại Việt Nam khi có dấu hiệu bất thường.
- Khoảng trống thị trường cho NeuroLink: NeuroLink tiếp cận theo hướng kỹ thuật y sinh chuyên sâu: không đầu tư chi phí vào hệ thống loa dẫn truyền xương đắt đỏ để ru ngủ, mà tập trung vào nhiệm vụ giám sát an toàn sóng não ban đêm cho người cao tuổi, học đường cơ sở cá nhân hóa và cung cấp kênh phối hợp tư vấn từ xa cùng bác sĩ thần kinh nội địa.


d. Vòng 4: Thiết bị quang học cổ tay và bo mạch sao chép giá rẻ Thẩm Quyến
- Đại diện tiêu biểu: Apple Watch Series 9/10, Oura Ring Gen 3/4, Garmin, Omron HeartGuide; các module đo sóng não giá rẻ TGAM (NeuroSky) và module ADS1299 trần bán trên các sàn thương mại điện tử Trung Quốc.
- Đặc tính kỹ thuật và giới hạn vật lý:
  + Giới hạn vật lý của cảm biến quang học PPG: Thiết bị đeo cổ tay hoặc nhẫn chỉ sử dụng đèn LED quang học để đo biến thiên thể tích máu vi mạch ngoại vi, từ đó tính toán nhịp tim và biến thiên nhịp tim (HRV). Phương pháp quang học hoàn toàn không ghi nhận được điện thế hoạt động của các nơ-ron vỏ não (ở thang đo microvolt). Tai biến thiếu máu cục bộ cấp tính gây ra sự ức chế nơ-ron cục bộ sinh ra sóng chậm và mất đối xứng bán cầu ngay trong những phút đầu tiên, trong khi nhịp tim và mạch ngoại vi chỉ biến đổi trễ khi cơ thể xảy ra phản ứng sốc tuần hoàn. Thêm vào đó, khi người ngủ đè tay lên gối, cảm biến PPG dễ bị hở tạo ra báo động giả liên tục.
  + Giới hạn chất lượng của bo mạch sao chép giá rẻ: Module TGAM chỉ có 1 kênh trán đơn cực, xử lý qua chip chuyên dụng đóng kín thuật toán eSense với mức nhiễu nền lớn, không đo được tín hiệu vi sai hai bán cầu. Các module ADS1299 trần trên thị trường giá rẻ (50 đến 80 USD) chỉ dùng mạch 2 lớp hoặc 4 lớp gia công thô, không có mặt phẳng mass tách biệt AGND/DGND và không có vành bao bảo vệ chống nhiễu, dẫn đến sàn nhiễu vật lý thực tế vượt quá 5 đến 10 uVrms (làm sai lệch hoàn toàn biên độ sóng não vốn chỉ từ 10 đến 50 uV), không đạt tiêu chuẩn dòng rò y tế IEC 60601-1.


e. Bảng so sánh đối chiếu đa chiều giữa NeuroLink và các nhóm đối thủ

| Tiêu chí kỹ thuật và vận hành | NeuroLink (Đề xuất) | Ceribell Rapid EEG | OpenBCI Cyton 8-ch | Emotiv EPOC X | Frenz Brainband (Earable) | Thiết bị PPG (Apple/Oura) | Mạch nhái Thẩm Quyến |
|---|---|---|---|---|---|---|---|
| Số kênh EEG và cơ chế xuất dữ liệu | 8 kênh vi sai (Lab) / 2-4 kênh (Đai ngủ); xuất mở CSV, LSL, API | 8 kênh vi sai qua đai trán; trích xuất qua cổng đám mây bệnh viện | 8 kênh vi sai mở; xuất dữ liệu trực tiếp qua LSL, BrainFlow | 14 kênh nỉ muối; khóa dữ liệu thô sau thuê bao EmotivPRO | 7 cảm biến (EEG, EOG, EMG, PPG); đóng kín trong ứng dụng di động | 0 kênh EEG (chỉ đo biến thiên mạch ngoại vi PPG) | 1 kênh đơn cực (TGAM) hoặc 8 kênh trần không có SDK |
| Giá thành phần cứng và rào cản tại ĐH VN | Chi phí linh kiện thấp; thiết kế và sản xuất nội địa; hỗ trợ tại chỗ | Bán đai dán dùng 1 lần đắt đỏ theo hợp đồng trọn gói bệnh viện | Giá bo mạch 1.249 USD; phụ thuộc nhập khẩu; thủ tục hải quan lâu | Giá 849-999 USD cộng phí bản quyền phần mềm định kỳ | Giá bán lẻ 680 USD (khoảng 17 triệu VNĐ); hướng khách cao cấp | Giá 300-500 USD; phổ biến nhưng không đo được điện não | Giá 30-80 USD; rẻ nhưng sàn nhiễu lớn và không có bảo hành |
| Bác sĩ chuyên khoa đọc và gán nhãn | Cơ chế đồng thuận 2 bác sĩ có CCHN đổi tín chỉ Credit nội bộ | Chuyên gia thần kinh đọc qua cổng đám mây của hãng tại Mỹ | Không có hệ sinh thái bác sĩ lâm sàng đi kèm thiết bị | Không có hệ sinh thái bác sĩ lâm sàng đi kèm thiết bị | Không kết nối hồ sơ tới mạng lưới bác sĩ thần kinh nội địa | Không kết nối phân tích sóng não với bác sĩ chuyên khoa | Không có hệ thống phần mềm hay chuyên gia y tế |
| Baseline cá nhân hóa và quy tắc FAST | Học đường nền 7 đêm đầu; tính BSI đối xứng; khóa an toàn CM[2,1]=0 | Phân tích NCSE cấp cứu; theo dõi ADR; không học đường nền ngủ | Không có thuật toán học đường nền cá nhân hóa tự động | Không có thuật toán học đường nền cá nhân hóa tự động | Tối ưu âm thanh ru ngủ cá nhân; không có quy tắc y tế FAST | Phân tích nhịp tim nền; hoàn toàn không có quy tắc FAST | Không có thuật toán phân tích hay cảnh báo an toàn |
| Hành lang pháp lý và ứng dụng tại VN | Thử nghiệm Sandbox NQ 136/2024/QH15 tại Đà Nẵng; đo kiểm IRB | Đạt FDA 510(k) Mỹ; chưa phân phối phổ cập tại tuyến cơ sở VN | Thiết bị nghiên cứu giáo dục; không đăng ký y tế tại VN | Thiết bị nghiên cứu thương mại; không đăng ký y tế tại VN | Thiết bị chăm sóc sức khỏe giấc ngủ thông thường (Wellness) | Thiết bị điện tử đeo thông thường; không chẩn đoán đột quỵ | Thiết bị linh kiện điện tử rời; không chứng nhận an toàn |


f. Khoảng trống thị trường và định vị chiến lược của NeuroLink

- Khoảng trống thị trường xác thực: Thị trường hiện tại tồn tại một khoảng cách lớn giữa hai thái cực: một bên là các hệ thống điện não lâm sàng đắt đỏ (Ceribell, Nihon Kohden) chỉ nằm trong phòng cấp cứu lớn và đòi hỏi chuyên viên thao tác; một bên là các thiết bị tiêu dùng cá nhân (Frenz, Apple Watch) chỉ tập trung vào ru ngủ hoặc đếm bước chân mà bỏ trống hoàn toàn bài toán giám sát an toàn mạch máu não ban đêm cho người cao tuổi. Trong khi đó, các trường đại học kỹ thuật và y dược tại Việt Nam thiếu một bộ công cụ đo sóng não mở với chi phí thực tế phù hợp để đào tạo và nghiên cứu.
- Định vị sinh tồn của NeuroLink: Dự án định vị là hệ sinh thái kỹ thuật y sinh mở phân tầng: cung cấp phần cứng đo điện não chuẩn xác với chi phí chế tạo nội địa hóa, mở API cho khối đào tạo đại học để tạo chân rết chuyên môn, và ứng dụng thuật toán học đường cơ sở cá nhân hóa kết hợp mạng lưới bác sĩ thần kinh nội địa để bảo vệ sức khỏe giấc ngủ gia đình.


2. Cơ chế kỹ thuật 4 lớp chống ăn cắp mô hình AI và chống làm nhái phần cứng

a. Lớp 1: Tách biệt Edge DSP và Cloud Inference (Zero Weight Exposure)

- Phân tích véc-tơ tấn công: Kẻ sao chép mua thiết bị phần cứng thương mại, sử dụng máy khò nhiệt tháo chip vi điều khiển hoặc chip nhớ Flash, dùng thiết bị đọc bộ nhớ ngoài để trích xuất mã nhị phân firmware nhằm bóc tách trọng số mạng nơ-ron (Model Extraction Attack).
- Giải pháp phòng thủ kỹ thuật của NeuroLink:
  + Triệt tiêu hoàn toàn sự hiện diện của trọng số mô hình AI trên thiết bị đeo (Nguyên lý Zero Weight Exposure).
  + Vi điều khiển gắn trên đai đeo (dòng SoC nRF52832 hoặc nRF52840 của Nordic Semiconductor) chỉ đảm nhiệm các thuật toán xử lý tín hiệu số (DSP) nhân quả nhẹ: Bộ lọc IIR bậc 2 khử nhiễu điện lưới Notch 50Hz, bộ lọc thông dải Bandpass nhân quả từ 0.5 đến 40Hz, bộ đệm vòng lưu trữ cửa sổ trượt 4 giây, mạch kiểm tra trở kháng tiếp xúc điện cực rơi (Lead-off Check dòng bơm 6 nA) và mô-đun đóng gói mã hóa khung truyền tin BLE.
  + Toàn bộ pipeline trí tuệ nhân tạo chuyên sâu: Không gian trích xuất 80 đặc trưng bất biến biên độ (DAR, TAR, BSI đối xứng hai bán cầu, wPLI liên vùng, contrast trước-sau), mô hình học máy 3 lớp bệnh lý, thuật toán học đường nền cá nhân hóa 7 đêm đầu và Hàng rào an toàn chi phí lâm sàng đa tầng với bất biến sinh mạng tuyệt đối CM[2,1] bằng đúng 0 đều được triển khai tập trung trên Cloud Server Backend (môi trường Python FastAPI).
- Hệ quả kỹ thuật: Khi đối thủ tháo rã phần cứng hoặc đọc trộm toàn bộ bộ nhớ Flash của vi điều khiển, họ chỉ thu được các thuật toán lọc số học cơ bản. Toàn bộ tài sản trí tuệ cốt lõi về mô hình AI vẫn được bảo toàn tuyệt đối trên máy chủ.


b. Lớp 2: Khóa đọc Flash MCU và Xác thực Thiết bị Bắt tay Mật mã

- Phân tích véc-tơ tấn công: Các xưởng sản xuất điện tử sao chép nguyên mẫu sơ đồ chân và layout bo mạch, sản xuất hàng loạt phần cứng giá rẻ rồi kết nối trực tiếp vào máy chủ NeuroLink để sử dụng miễn phí trạm phân tích qEEG và ứng dụng cảnh báo người dùng.
- Giải pháp phòng thủ kỹ thuật của NeuroLink:
  + Cấu hình thanh ghi khóa phần cứng APPROTECT (Access Port Protection) trên vi điều khiển nRF52: Khóa vĩnh viễn giao tiếp cổng nạp và gỡ lỗi phần cứng SWD/JTAG ở cấp độ silicon trước khi xuất xưởng, ngăn chặn các công cụ nạp dịch ngược bộ nhớ nội.
  + Cơ chế xác thực thiết bị dựa trên mật mã bất đối xứng (Device Certificate Challenge-Response): Mỗi bo mạch chính hãng khi xuất xưởng được nạp một khóa riêng tư (Private Key) duy nhất vào vùng nhớ bảo vệ OTP (kết hợp định danh phần cứng duy nhất từ chip EEPROM 24AA256UID). Khi thiết bị khởi động và kết nối vào hệ thống, máy chủ gửi xuống một chuỗi ngẫu nhiên (Nonce Challenge). Thiết bị phải thực hiện thuật toán ký số mã hóa (HMAC-SHA256) và gửi trả lại chữ ký số. Máy chủ đối soát chữ ký với danh mục khóa công khai hợp lệ trong cơ sở dữ liệu mới mở cổng tiếp nhận dữ liệu sóng não.
- Hệ quả kỹ thuật: Các bo mạch sao chép trái phép từ các xưởng gia công bên ngoài không sở hữu chứng thư số hợp lệ, sẽ bị máy chủ API Gateway từ chối kết nối ngay ở tầng bắt tay mạng (lỗi 401 Unauthorized), biến phần cứng nhái thành thiết bị cô lập không thể hoạt động với hệ thống phần mềm.


c. Lớp 3: Chiến lược Mở Có Chọn Lọc (Open-Core Architecture)

- Phân tích sự đánh đổi kỹ thuật: Nếu đóng kín toàn bộ hệ thống, dự án sẽ gặp định kiến độc quyền, không thu hút được cộng đồng nghiên cứu và sinh viên đại học. Nếu mở toàn bộ mã nguồn và bản vẽ sản xuất, các xưởng gia công sẽ sao chép trọn vẹn kiểu dáng công nghiệp.
- Giải pháp phân tầng cấu trúc của NeuroLink:
  + Cấu phần mở (Open Tier): Nhóm công khai mã nguồn bộ công cụ SDK Python, các mô-đun kết nối giao thức Lab Streaming Layer (LSL), script nhận luồng dữ liệu thời gian thực và tài liệu mô tả API RESTful. Động thái này xóa bỏ điểm nghẽn thu phí dữ liệu thô của Emotiv, biến NeuroLink thành công cụ nghiên cứu thân thiện được sinh viên và giảng viên ưu tiên lựa chọn.
  + Cấu phần đóng (Proprietary Core):
    - Đóng kín toàn bộ bộ tệp sản xuất Gerber và thiết kế mạch in 6 lớp HDI Master (ads1299_eeg_daq_6layer.kicad_pcb) với cấu trúc các lớp mass AGND/DGND cách ly, vành bao bảo vệ (guard-ring) và nghiệm thu 0 lỗi DRC.
    - Đăng ký bảo hộ Giải pháp hữu ích tại Cục Sở hữu Trí tuệ cho cấu trúc hình học và cơ chế tiếp xúc da của cụm điện cực khô vùng tai.
    - Đóng kín toàn bộ mã nguồn xử lý tín hiệu tại Cloud Server: Pipeline 80 đặc trưng bất biến độ lợi, thuật toán hiệu chuẩn miền đối kháng, bộ chỉ số đánh giá chất lượng tín hiệu tự động (SQI) và kho dữ liệu sóng não Neural DB.


d. Lớp 4: Khóa Chuyển Đổi Bằng Hồ Sơ Đường Cơ Sở Cá Nhân Hóa Dài Hạn

- Phân tích hành vi dữ liệu: Sóng điện não của con người mang tính đặc thù cá thể rất cao do sự sai khác về cấu trúc xương sọ, độ dày da đầu và nhịp sinh học riêng biệt. Một ngưỡng cảnh báo cố định dùng chung cho toàn bộ cộng đồng luôn dẫn đến sự đánh đổi giữa việc bỏ sót bệnh lý và phát sinh báo động giả.
- Cơ chế tạo rào cản chuyển đổi của NeuroLink:
  + Nền tảng xây dựng ma trận đường cơ sở cá nhân hóa (Personalized Longitudinal Baseline) được tự động học liên tục qua 7 đêm đầu tiên và cập nhật thích nghi trong suốt 3 đến 6 tháng sử dụng đai đeo của người bệnh. Hồ sơ này bao gồm phổ công suất tương đối cá nhân, tỷ số DAR/TAR chuẩn trong trạng thái ngủ sâu và chỉ số bất đối xứng bán cầu BSI đặc trưng của từng cá thể.
  + Ma trận dữ liệu này được mã hóa và lưu trữ duy nhất trên tài khoản đám mây của gia đình. Nếu người dùng chuyển sang sử dụng một thiết bị phần cứng nhái hoặc thiết bị của hãng khác, họ sẽ đánh mất toàn bộ lịch sử đường cơ sở đã tích lũy, thiết bị mới sẽ phải học lại từ đầu và tỷ lệ phát sinh báo động giả nửa đêm sẽ tăng vọt.
  + Tương tự đối với cộng đồng nghiên cứu và bác sĩ: Ví tín chỉ tích lũy (CreditWallet), chỉ số uy tín học thuật (Impact Score) và quyền truy cập kho dữ liệu đặc quyền gắn liền với tài khoản nền tảng, tạo ra chi phí chuyển đổi rất lớn ngăn ngừa người dùng rời bỏ hệ sinh thái.


3. Hệ thống 5 hào lũy phòng thủ và chiến lược sinh tồn bất đối xứng (Judo Strategy)

a. Hào lũy 1: Kho dữ liệu EEG người Việt gắn nhãn đồng thuận kép

- Bản chất rào cản: Các mô hình trí tuệ nhân tạo quốc tế khi áp dụng trực tiếp lên bệnh nhân Việt Nam thường gặp hiện tượng suy giảm độ chính xác do sai lệch miền phân bố (domain shift) về nhân khẩu học và mô hình bệnh học. Việc xây dựng một kho dữ liệu sóng não có nhãn lâm sàng chuẩn đòi hỏi kinh phí hàng tỷ đồng nếu thuê bác sĩ gán nhãn theo giờ công truyền thống.
- Đòn bẩy bất đối xứng của NeuroLink:
  + Tận dụng lực lượng hơn 10.000 bác sĩ tốt nghiệp mỗi năm cùng hàng ngàn bác sĩ nội trú, học viên sau đại học tại các trường Y Dược lớn đang cần công cụ phân tích dữ liệu phục vụ nghiên cứu khoa học và luận văn.
  + Nền tảng cung cấp miễn phí trạm lọc nhiễu và định lượng qEEG; đổi lại, các bác sĩ tham gia thẩm định và gán nhãn cho các đoạn sóng não ẩn danh. Hệ thống thiết lập quy tắc đồng thuận mù 2 chuyên gia (2-Reader Blind Consensus): Một bản ghi chỉ được đưa vào tập dữ liệu huấn luyện chuẩn khi có ít nhất 2 bác sĩ có chứng chỉ hành nghề xác nhận trùng khớp nhãn và chỉ số chất lượng tín hiệu SQI đạt trên 0,80.
  + Bác sĩ được hệ thống tặng lại tín chỉ (Credit) để đổi quyền trích xuất dữ liệu phục vụ đề tài nghiên cứu riêng của họ.
  + Chi phí tiền mặt thuê người gán nhãn: Đúng 0 VNĐ. Tài sản tích lũy là kho dữ liệu điện não người Việt đa trung tâm tăng trưởng tự nhiên theo quy mô người dùng, tạo nên rào cản dữ liệu mà các đối thủ nước ngoài không thể mua được trong thời gian ngắn.


b. Hào lũy 2: Chiến lược thâm nhập giáo dục đại học (Trojan Horse Strategy)

- Mô hình tham chiếu: Chiến lược xâm nhập kinh điển của Arduino trong đào tạo phần cứng và MATLAB, LabVIEW trong đào tạo kỹ thuật đo lường. Khi sinh viên và giảng viên quen thuộc với một nền tảng công cụ ngay trong các bài thí nghiệm đại học, họ sẽ tiếp tục mang chính công cụ đó vào quy trình làm việc chuyên nghiệp khi ra trường.
- Triển khai thực tế của NeuroLink:
  + Tiếp cận trực tiếp mạng lưới hơn 240 trường đại học tại Việt Nam, đặc biệt là gần 40 trường đào tạo khối ngành Y Dược và hơn 65 khoa Kỹ thuật Y sinh, Điện tử Viễn thông, Công nghệ Thông tin và Trí tuệ Nhân tạo.
  + Cung cấp Bộ Kit nghiên cứu 8 kênh chuẩn ADS1299 với chi phí hợp lý, tài liệu hướng dẫn thực hành tiếng Việt và SDK Python mở hoàn toàn.
  + Hệ quả chiến lược: Tạo thói quen sử dụng nền tảng cho thế hệ kỹ sư y sinh và bác sĩ trẻ trước khi tốt nghiệp. Khi lực lượng này về công tác tại các cơ sở y tế địa phương, NeuroLink đã trở thành công cụ định lượng quen thuộc, vô hiệu hóa nỗ lực thâm nhập của các thiết bị đóng đắt tiền từ nước ngoài.


c. Hào lũy 3: Quy trình phối hợp bác sĩ chuyên khoa nội địa (Doctor-in-the-loop Workflow)

- Điểm yếu của các tập đoàn công nghệ lớn và thiết bị ngoại:
  + Đồng hồ Apple Watch hay nhẫn Oura chỉ hiển thị biểu đồ nhịp tim trên màn hình; khi phát hiện chỉ số bất thường, ứng dụng chỉ đưa ra khuyến cáo chung chung hướng dẫn người dùng đi khám bệnh mà không có bất kỳ kênh hỗ trợ chuyên môn nào tại Việt Nam.
  + Các bộ Kit nghiên cứu như OpenBCI hoàn toàn không có giao diện ứng dụng kết nối bác sĩ dành cho người dùng cuối.
- Khác biệt thực tế của NeuroLink:
  + Xây dựng luồng vận hành khép kín: Khi thuật toán máy chủ phát hiện chỉ số sóng chậm và mất đối xứng bán cầu vượt ngưỡng đường nền ban đêm, hệ thống tự động khởi tạo phiếu tư vấn chuyên môn (ConsultationTicket). Đoạn sóng não đã lọc sạch nhiễu được chuyển tiếp an toàn tới hàng đợi của các bác sĩ thần kinh có CCHN trong mạng lưới.
  + Bác sĩ xem xét dạng sóng trên trạm Web qEEG chuẩn và phản hồi định hướng theo cấu trúc 3 phần rõ ràng: nhận xét hình thái sóng, giải thích kiến thức tham khảo và khuyến nghị hướng thăm khám.
  + Tích hợp bộ quy tắc phân loại lâm sàng FAST (Face - Arm - Speech - Time): Nếu chỉ số mất đối xứng BSI vượt ngưỡng nguy hiểm (BSI lớn hơn hoặc bằng 0,22) kèm triệu chứng méo miệng hoặc yếu chi, màn hình tự động bật cảnh báo đỏ hướng dẫn gia đình gọi cấp cứu 115 đưa đến bệnh viện có đơn vị đột quỵ gần nhất, kích hoạt hàng rào an toàn CM[2,1]=0 bảo đảm tính mạng tuyệt đối cho người bệnh.


d. Hào lũy 4: Hàng rào pháp lý và thời gian thử nghiệm lâm sàng tại địa phương

- Quy định pháp lý chặt chẽ:
  + Trang thiết bị y tế tại Việt Nam chịu sự quản lý nghiêm ngặt theo Nghị định 98/2021/NĐ-CP và Nghị định 07/2023/NĐ-CP. Để một thiết bị có tính năng hỗ trợ chẩn đoán y khoa được cấp Số lưu hành, quy trình thử nghiệm lâm sàng độc lập thông qua Hội đồng Đạo đức (IRB) tại bệnh viện kéo dài từ 12 đến 24 tháng.
- Lợi thế bảo hộ địa phương của NeuroLink:
  + Dự án xuất phát từ Đại học Bách Khoa - ĐH Đà Nẵng, kết nối chặt chẽ với Trung tâm Hỗ trợ Khởi nghiệp Đổi mới Sáng tạo Đà Nẵng (DISSC - Sở Khoa học và Công nghệ) và cơ chế thử nghiệm có kiểm soát (Sandbox) theo Nghị quyết 136/2024/QH15 của Quốc hội.
  + Kế hoạch đo kiểm đối chứng song song cùng máy điện não lâm sàng tại Bệnh viện Đà Nẵng tạo ra bộ hồ sơ kiểm định khoa học chính quy.
  + Tác dụng ngăn chặn: Khoảng thời gian từ 12 đến 24 tháng kiểm định lâm sàng đóng vai trò như một bức tường phòng thủ vững chắc, ngăn chặn hoàn toàn các sản phẩm phần cứng tiểu ngạch giá rẻ từ nước ngoài hoặc các nhóm sao chép nhảy vào thị trường khám chữa bệnh mà không có giấy phép lưu hành hợp pháp.


e. Hào lũy 5: Kiến trúc phần cứng mô-đun kép tối ưu hóa chi phí sản xuất

- Phân rã kiến trúc phần cứng:
  + Dự án không cố gắng tạo ra một thiết bị duy nhất cho mọi nhu cầu, mà phân tách thành hai mô-đun phần cứng riêng biệt về quy trình gia công nhưng dùng chung lõi thuật toán:
  + Phiên bản Mô-đun A (Phòng thí nghiệm và Giảng dạy): Bo mạch đo 8 kênh vi sai 24-bit sử dụng chip TI ADS1299 cao cấp, thiết kế 6 lớp HDI đạt chuẩn True Zero DRC, đầy đủ cổng giao tiếp SPI/I2C và đo đa vị trí chuẩn 10-20. Phục vụ nhu cầu nghiên cứu học thuật đòi hỏi độ phân giải tín hiệu tối đa.
  + Phiên bản Mô-đun B (Đai đeo ngủ gia đình): Cấu hình thu gọn tối giản 2 đến 4 kênh vi sai đối xứng hai bên thái dương và hõm tai (vùng giải phẫu nhạy cảm với bất đối xứng tưới máu động mạch não giữa MCA), sử dụng IC đo sinh học AFE tiêu thụ điện năng thấp kết hợp SoC nRF52 BLE.
- Tối ưu hóa chuỗi cung ứng: Phiên bản Mô-đun B cắt giảm hơn 60% chi phí linh kiện so với bản 8 kênh, sử dụng pin dung lượng nhỏ hơn, bảo đảm thời lượng pin hoạt động liên tục suốt đêm ngủ mà vẫn duy trì độ chính xác của thuật toán tính toán chỉ số bất đối xứng bán cầu BSI.


4. Kịch bản phản công khi các đối thủ lớn tấn công (What If Analysis)

a. Kịch bản 1: Apple, Samsung hoặc Oura đưa cảm biến điện sinh học lên thiết bị đeo vùng đầu hoặc tai

- Tình huống giả định: Các tập đoàn công nghệ lớn tích hợp cảm biến điện não khô vào tai nghe không dây hoặc đai đeo đầu tiêu dùng và bán ra toàn cầu.
- Đánh giá tương quan lực lượng:
  + Lợi thế của Big Tech: Tiềm lực tài chính khổng lồ, năng lực sản xuất quy mô lớn và nhận diện thương hiệu toàn cầu.
  + Hạn chế cốt tử của Big Tech tại thị trường y tế Việt Nam:
    - Rủi ro trách nhiệm pháp lý: Để tránh các vụ kiện tụng y khoa quốc tế, các tập đoàn lớn luôn khóa tính năng thiết bị ở mức theo dõi sức khỏe tổng quát (General Wellness), tuyệt đối không đưa ra các kết luận mang tính định hướng lâm sàng hoặc can thiệp cấp cứu.
    - Thiếu mạng lưới bác sĩ lâm sàng bản địa: Họ không có hạ tầng kết nối trực tiếp với đội ngũ bác sĩ chuyên khoa thần kinh có CCHN tại các bệnh viện Việt Nam để đọc bản ghi và xử lý ca bệnh.
    - Thiếu sự chuẩn hóa dữ liệu địa phương: Thuật toán toàn cầu không được hiệu chuẩn trên mô hình bệnh học và phân bố tín hiệu điện não của người cao tuổi Việt Nam.
- Chiến lược phản công của NeuroLink:
  + Không cạnh tranh đối đầu ở khâu sản xuất phần cứng tiêu dùng đại trà. NeuroLink định vị là nền tảng xử lý dữ liệu và điều phối dịch vụ y sinh (Software and Service Platform): Nếu tai nghe của các hãng lớn mở API dữ liệu thô, NeuroLink sẵn sàng mở cổng tiếp nhận dữ liệu sóng não đó vào trạm Web qEEG và kết nối vào quy trình Doctor-in-the-loop nội địa.
  + Tận dụng chiến dịch truyền thông của các tập đoàn lớn để người dân hiểu rõ giá trị của điện não đồ, sau đó khai thác thị trường bằng dịch vụ kết nối bác sĩ chuyên khoa và quy tắc an toàn cấp cứu FAST bản địa.


b. Kịch bản 2: Earable đưa Frenz Brainband phiên bản giá rẻ về thị trường Việt Nam

- Tình huống giả định: Earable Neuroscience quyết định hạ giá sản phẩm Frenz Brainband xuống phân khúc dưới 200 USD hoặc tung ra các chương trình trợ giá quy mô lớn tại Việt Nam.
- Đánh giá tương quan lực lượng:
  + Frenz Brainband có thế mạnh về kiểu dáng công nghiệp tiêu dùng và liệu pháp âm thanh ru ngủ qua xương. Tuy nhiên, kiến trúc sản phẩm của họ được thiết kế tối ưu cho vòng lặp ru ngủ cá nhân, hoàn toàn không có thuật toán phát hiện đột quỵ, không có rào chắn an toàn tPA và không kết nối quy trình tư vấn y tế.
- Chiến lược phản công của NeuroLink:
  + Giữ vững định vị y sinh chuyên sâu: NeuroLink không chạy đua phát triển tính năng kích thích âm thanh ru ngủ đắt đỏ. Dự án tập trung toàn bộ nguồn lực vào bài toán an toàn thần kinh: phát hiện bất đối xứng bán cầu ban đêm, rào chắn an toàn sinh mạng CM[2,1]=0 và liên kết cấp cứu 115 cho người cao tuổi.
  + Đòn bẩy tâm lý khách hàng gia đình: Sản phẩm của NeuroLink giải quyết nỗi lo lắng của con cái đi làm xa đối với cha mẹ già ở quê (nhóm đối tượng mà các sản phẩm ru ngủ cá nhân xa xỉ không tiếp cận).
  + Đòn bẩy học thuật: Bộ Kit 8 kênh NeuroLink mở hoàn toàn dữ liệu thô phục vụ nghiên cứu đại học với mức giá chỉ bằng một phần nhỏ giá bán của Frenz, chiếm lĩnh toàn bộ thị phần phòng thí nghiệm trong nước.


c. Kịch bản 3: Các xưởng phần cứng Thẩm Quyến bán bo mạch sao chép ADS1299 kèm ứng dụng bẻ khóa

- Tình huống giả định: Các nhà sản xuất Trung Quốc sao chép nguyên mẫu sơ đồ chân ADS1299, bán tràn lan trên các sàn thương mại điện tử với giá siêu rẻ kèm bản sao giao diện Web.
- Đánh giá tương quan lực lượng:
  + Mạch nhái giá rẻ bị giới hạn vật lý nghiêm trọng: Để hạ giá thành, các xưởng bắt buộc phải dùng mạch 2 lớp hoặc 4 lớp rẻ tiền, loại bỏ vành bao bảo vệ guard-ring và không có mặt phẳng mass AGND/DGND cách ly. Hệ quả là sàn nhiễu vật lý sẽ tăng vọt lên trên 5 đến 10 uVrms, làm méo mó hoàn toàn tín hiệu sóng não microvolt. Khi đo thực tế, sóng não sẽ bị chôn vùi trong can nhiễu điện lưới 50Hz và xung nguồn.
- Chiến lược phản công của NeuroLink:
  + Kích hoạt cơ chế phòng thủ Lớp 2: Khóa phần cứng APPROTECT trên vi điều khiển chính hãng và cơ chế xác thực chứng thư số thiết bị (Device Certificate Challenge-Response). Bo mạch nhái không có khóa bí mật lưu trong chip sẽ bị máy chủ API từ chối kết nối ngay lập tức.
  + Cổng kiểm soát chất lượng tín hiệu tự động (SQI Gate): Nếu dữ liệu từ mạch nhái được truyền vào trạm Web, bộ lọc SQI sẽ tự động phát hiện sàn nhiễu vượt ngưỡng và chặn phân tích, hiển thị cảnh báo đỏ "Chất lượng phần cứng không đạt chuẩn y sinh".
  + Rào cản niềm tin y tế: Trong lĩnh vực sức khỏe và an toàn tính mạng, các cơ sở nghiên cứu và hộ gia đình không bao giờ mạo hiểm sử dụng bo mạch trôi nổi không có chứng nhận an toàn điện sinh học và cam kết bảo mật dữ liệu.


d. Kịch bản 4: Các bệnh viện lớn hoặc trường đại học khác tự phát triển hệ thống tương tự

- Tình huống giả định: Một trường đại học hoặc viện nghiên cứu lớn tại Hà Nội hoặc TP. Hồ Chí Minh đầu tư kinh phí tự nghiên cứu và chế tạo trạm qEEG cùng bo mạch đo điện não.
- Đánh giá tương quan lực lượng:
  + Để hoàn thiện một hệ sinh thái kỹ thuật từ bo mạch 6 lớp HDI đạt 0 lỗi DRC, bộ lọc streaming thời gian thực trễ dưới 10 ms, bộ 80 đặc trưng bất biến đã kiểm nghiệm mù trên tập dữ liệu quốc tế UCLH London và nền tảng 4 trụ cột vận hành có cơ chế ví Credit đòi hỏi thời gian nghiên cứu thực nghiệm từ 2 đến 3 năm.
- Chiến lược phản công của NeuroLink:
  + Chuyển hóa đối thủ tiềm năng thành đối tác thụ hưởng: Thay vì cạnh tranh khép kín, NeuroLink áp dụng chính sách liên minh học thuật mở rộng. Dự án sẵn sàng cung cấp trạm Web qEEG và hỗ trợ kỹ thuật bo mạch nghiên cứu cho các nhóm nghiên cứu tại các trường bạn phục vụ đề tài khoa học.
  + Mời các giáo sư, chuyên gia đầu ngành tham gia Hội đồng cố vấn khoa học và trở thành chuyên gia thẩm định nhãn cấp cao trên hệ sinh thái với đặc quyền trích xuất dữ liệu đa trung tâm.
  + Khi các cơ sở bạn sử dụng nền tảng của NeuroLink để công bố bài báo khoa học, kho dữ liệu của NeuroLink càng tăng trưởng mạnh mẽ và vị thế chuẩn mực của hệ thống càng được củng cố vững chắc trong cộng đồng y sinh học Việt Nam.


IV. TÍNH KHẢ THI VẬN HÀNH VÀ KẾ HOẠCH KHẢO NGHIỆM THỰC TẾ

1. Bảng đối chiếu logic cân đối giữa các cấu phần sản phẩm và kiểm soát nguồn lực

Thay vì đặt nặng các dự phóng doanh thu khổng lồ chưa kiểm chứng, tính bền vững của mô hình được thể hiện qua sự tự cân đối trên từng cấu phần vận hành:

| Cấu phần Hệ thống | Đối tượng Sử dụng | Hình thức Cung cấp | Chi phí Phát sinh Thực tế | Logic Tự Duy trì và Tạo Giá trị |
|---|---|---|---|---|
| (1) Bộ Kit Đo Sóng não 8 kênh + API | Phòng Lab ĐH, Nhóm nghiên cứu, Cơ sở trị liệu | Bán thiết bị nghiên cứu & cấp tài khoản phần mềm | Linh kiện mạch 6 lớp, vỏ hộp và gia công theo lô nhỏ | Chi phí thấp hơn nhiều so với nhập ngoại nên dễ tiếp cận ngân sách đề tài; tạo nguồn thu thực tế ngay Giai đoạn 1 để nuôi R&D |
| (2) Trạm Web qEEG Học thuật (RUO) | Bác sĩ trẻ, Bác sĩ nội trú, Nghiên cứu sinh | Miễn phí (giới hạn lượt cá nhân) đổi lấy nhãn dữ liệu | Chi phí tính toán máy chủ rất nhỏ trên mỗi bản ghi | Chuyên gia được công cụ làm nghiên cứu miễn phí; dự án thu được kho dữ liệu gán nhãn đồng thuận 2 người mà không tốn tiền mua nhãn |
| (3) Vòng đeo Theo dõi Giấc ngủ | Người mất ngủ, Con cái mua cho cha mẹ lớn tuổi | Bán thiết bị hoặc cho mượn có đặt cọc bảo toàn linh kiện | Linh kiện mạch thu gọn vùng tai, pin và đệm dẫn điện | Thu hồi ngay chi phí sản xuất phần cứng; mở rộng mạng lưới thiết bị đo thực tế hàng đêm tại hộ gia đình |
| (4) Tài khoản Cảnh báo Gia đình & Đệm thay thế | Hộ gia đình đang sử dụng vòng đeo ngủ | Phí duy trì phần mềm hàng tháng & bán rời đệm định kỳ | Máy chủ lưu trữ chuỗi thời gian, dịch vụ gọi cảnh báo tự động | Xử lý tự động 100% bằng thuật toán (không kèm lương bác sĩ) nên phí hàng tháng nhẹ nhàng vẫn dư bù đắp hạ tầng đám mây |
| (5) Kết nối Bác sĩ Giải thích Biểu đồ | Gia đình có bản ghi đêm bất thường cần hỏi thêm | Thu phí theo từng lượt yêu cầu tư vấn | Phần lớn chuyển trả thù lao cho bác sĩ nhận đọc ca | Không nuôi bác sĩ lương cứng; có ca yêu cầu mới phát sinh giao dịch nên hệ thống không chịu rủi ro chi phí cố định |

2. Lộ trình khảo nghiệm thực chứng và các cột mốc kiểm tra (Validation Roadmap)

Để chứng minh tính khả thi từng bước theo phương pháp kỹ thuật thực nghiệm, dự án đặt ra ba chặng kiểm chứng rõ ràng:
- Chặng 1 - Khảo sát nhu cầu và kiểm chuẩn phòng thí nghiệm (Hiện tại - Tháng 6):
  + Hoàn tất khảo sát thực tế hai luồng (Người đi làm có cha mẹ lớn tuổi và Bác sĩ trẻ/Nghiên cứu sinh) thông qua biểu mẫu trực tuyến neurolink_market_survey.html để xác thực nhu cầu sử dụng, thói quen đeo khi ngủ và mức chi phí hợp lý.
  + Hàn lắp ráp thực tế lô bo mạch nguyên mẫu từ bản thiết kế PCB 6 lớp đã qua kiểm tra DRC, đo kiểm tra sàn nhiễu vật lý (Input-referred noise), độ suy giảm nhiễu 50Hz và dòng rò an toàn điện sinh học trên mô hình giả lập (Phantom test).
- Chặng 2 - Thử nghiệm thực địa nhóm nhỏ và cộng đồng học thuật (Tháng 6 - Tháng 12):
  + Chuyển giao 5 đến 10 bộ Kit đầu tiên cho các nhóm nghiên cứu sinh viên, giảng viên khối Kỹ thuật Y sinh - CNTT dùng thử thực tế để đánh giá độ ổn định tín hiệu và hoàn thiện giao diện Web qEEG.
  + Thử nghiệm đeo thực tế phiên bản theo dõi giấc ngủ trên nhóm tình nguyện viên gia đình trong 14 đến 30 đêm liên tục để đo tỷ lệ duy trì đeo máy, độ êm vành tai và tỷ lệ cảnh báo nhầm khi xoay trở tư thế ngủ.
- Chặng 3 - Đo đối chứng lâm sàng và đăng ký Sandbox y tế (Tháng 12 - Tháng 24):
  + Thông qua Hội đồng Đạo đức và cơ chế Sandbox Nghị quyết 136/2024/QH15 tại Đà Nẵng, tiến hành đo song song với máy điện não đa kênh tiêu chuẩn tại bệnh viện trên nhóm bệnh nhân có yếu tố nguy cơ để hiệu chuẩn thuật toán phát hiện bất đối xứng bán cầu và hoàn thiện hồ sơ pháp lý lưu hành.
