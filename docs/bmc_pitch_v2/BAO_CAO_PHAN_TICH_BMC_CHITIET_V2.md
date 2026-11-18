# BÁO CÁO PHÂN TÍCH TOÀN DIỆN MÔ HÌNH KINH DOANH BUSINESS MODEL CANVAS v2.0

Dự án: Nền tảng Theo dõi Sóng não Giấc ngủ và Sức khỏe Chủ động NeuroLink

Tài liệu phục vụ công tác thẩm định chuyên môn và bảo vệ chiến lược trước Hội đồng Khởi nghiệp và Đổi mới Sáng tạo. Hồ sơ kỹ thuật và dữ liệu kiểm chứng: [PROJECT_CONTEXT.md](file:///D:/PRJ_Personal/software_neuronlink_eeg/docs/PROJECT_CONTEXT.md), [STARTUP_STRATEGY_BMC.md](file:///D:/PRJ_Personal/software_neuronlink_eeg/docs/STARTUP_STRATEGY_BMC.md).

I. TỔNG QUAN MÔ HÌNH KINH DOANH VÀ DÒNG CHẢY LOGIC OSTERWALDER

1. Nguyên lý tách bạch Người chi trả (Payer) và Người sử dụng (End-User)

Đa số dự án thiết bị y tế tiêu dùng thất bại vì đánh đồng người sử dụng với người chi trả. Người cao tuổi tại Việt Nam có tâm lý sợ tốn tiền của con cái. Họ thường giấu bệnh và từ chối chi vài triệu đồng cho một thiết bị công nghệ. Nếu tiếp cận trực tiếp người cao tuổi, chi phí thuyết phục bán hàng sẽ rất lớn.

NeuroLink tách đôi hai đối tượng này. Người sử dụng là cha mẹ từ 55 tuổi trở lên có bệnh lý nền mất ngủ, huyết áp cao, suy giảm tuần hoàn não. Người chi trả là con cái trưởng thành trong độ tuổi 25 đến 45 tuổi có thu nhập ổn định và đi làm xa quê. Con cái mua thiết bị không phải để cha mẹ thao tác phức tạp. Họ mua sự an tâm cho bản thân. Họ muốn đêm ngủ ngon và sáng ra biết chắc cha mẹ ở quê vẫn bình an.

Bản chất kinh tế ở đây là hoán đổi giá trị tâm lý. Cha mẹ tiếp nhận thiết bị như một món quà hiếu nghĩa của con. Con cái theo dõi dữ liệu sức khỏe từ xa qua điện thoại. Khi có sự cố bất đối xứng bán cầu não lúc nửa đêm, hệ thống lập tức gọi điện cho con cái. Con cái đóng vai trò người giám sát và nhắc nhở cha mẹ đeo máy mỗi tối.

2. Lý do chọn mô hình Động cơ Kép và loại bỏ các phương án bẫy

Để tồn tại và tăng trưởng bền vững, startup bắt buộc phải vượt qua các ảo tưởng kinh doanh bằng tinh thần phản biện thực chứng:

- Loại bỏ bán và kê đơn y tế qua Nhà thuốc hoặc Phòng khám ở Pha 1:
Khi chưa có Số lưu hành Trang thiết bị Y tế (TBYT) do Bộ Y tế cấp (quy trình kiểm định hồ sơ loại C thường kéo dài 12 đến 18 tháng), mọi chuỗi nhà thuốc lớn, tổ chức công đoàn hay phòng khám tư nhân đều từ chối thu tiền trực tiếp từ bệnh nhân do rủi ro pháp lý và trách nhiệm liên đới. Lao vào kênh y tế chính quy ngay từ vạch xuất phát đồng nghĩa với việc doanh nghiệp tự đẩy mình vào tình trạng đóng băng doanh thu chờ giấy phép.

- Loại bỏ chính sách đặt cọc 990.000 đồng dưới giá vốn:
Chi phí sản xuất phần cứng (COGS) của thiết bị ở quy mô ban đầu là 1.150.000 đồng. Việc thu tiền đặt cọc 990.000 đồng sẽ làm âm dòng vốn lưu động 160.000 đồng trên mỗi máy xuất xưởng. Nếu người dùng giữ máy lâu dài hoặc mở rộng quy mô quá nhanh, startup sẽ nhanh chóng cạn kiệt tiền mặt. Thay vào đó, nếu khách hàng B2C muốn dùng thử 30 ngày, công ty áp dụng chính sách mua kèm cam kết hoàn tiền hoặc mức Đặt cọc bảo toàn vốn 1.500.000 đồng (cao hơn giá vốn sản xuất, bảo toàn 100% dòng tiền lưu động).

- Loại bỏ các ngách thị trường lệch lõi:
Các ý tưởng như làm mũ chống ngủ gật cho tài xế xe tải hay đồ chơi giáo dục STEAM cho học sinh đều làm phân tán nguồn lực kỹ thuật. Toàn bộ đội ngũ tập trung tuyệt đối vào trục giá trị duy nhất: Sóng não - Giấc ngủ - Thần kinh. Mọi dữ liệu thu thập được từ người dùng ban đêm đều trực tiếp phục vụ cho việc huấn luyện mô hình phát hiện sớm nguy cơ đột quỵ ở giai đoạn sau.

- Giải pháp đột phá: Kiến trúc Động cơ Kép (B2B + B2C Hợp pháp Ngày 1):
Doanh nghiệp kích hoạt đồng thời hai nhánh doanh thu hợp pháp 100% ngay từ ngày đầu tiên mà không vướng rào cản giấy phép y tế:
+ Nhánh B2B (Doanh thu nhanh, nuôi sống bộ máy): Thương mại hóa bộ công cụ nghiên cứu NeuroLink Research Kit (kèm API trích xuất sóng thô và phần mềm qEEG) cho các Khoa Kỹ thuật Y sinh, Khoa CNTT - AI của các trường Đại học, đồng thời cung cấp giải pháp đo lường chỉ số thư giãn não bộ cho các Trung tâm trị liệu giấc ngủ không dùng thuốc và Wellness Resort cao cấp tại Đà Nẵng và Hội An.
+ Nhánh B2C (Phủ rộng thị trường, gom dữ liệu thực địa): Phân phối vòng đeo ngủ NeuroLink Sleep Band dưới phân loại Thiết bị Hỗ trợ Giấc ngủ và Thể trạng (General Wellness Device) theo Nghị định 98/2021/NĐ-CP và Nghị định 07/2023/NĐ-CP cho phân khúc kỹ sư công nghệ và người làm việc trí óc mua cho bản thân hoặc báo hiếu cha mẹ.

II. PHÂN TÍCH CHI TIẾT 9 KHỐI BUSINESS MODEL CANVAS VÀ HÀNH LANG CHÍNH SÁCH

1. Phân khúc Khách hàng (Customer Segments)

a. Nội dung cô đọng dự kiến đưa lên bảng BMC:
- Số liệu Nỗi đau & Thị trường: Hơn 10 triệu người VN rối loạn giấc ngủ (30% người trưởng thành - Hội Y học Giấc ngủ VN); 14,8-16 triệu người cao tuổi, 200.000 ca đột quỵ/năm với 76,8% lỡ giờ vàng 4,5h (Bộ Y tế); >65 trường/viện khối Kỹ thuật - Y sinh & >220 khách sạn/resort 4-5 sao tại cụm Đà Nẵng - Hội An (Sở Du lịch).
- Nhóm 1 (B2B Ngắn hạn Pha 1): Lab Kỹ thuật Y sinh / CNTT - AI các trường ĐH và các Wellness Resort / Trung tâm Trị liệu Giấc ngủ - Tâm lý.
- Nhóm 2 (B2C Đại chúng Pha 1): Người mất ngủ kinh niên, nhân sự trí óc (25-45 tuổi) và con cái xa quê mua vòng theo dõi giấc ngủ cho cha mẹ (55+).
- Nhóm 3 & 4 (Đối tác & Pha 2-3): Bác sĩ/Chuyên gia đọc biểu đồ theo ca; Phòng khám tư (Neuro-Holter 3-5 đêm), Nhà thuốc & Viện BCI / Hãng Dược mua dữ liệu RWE.
- Quy mô Thị trường (Bottom-up): TAM: 16.200 tỷ VNĐ (~640 triệu USD) | SAM: 1.680 tỷ VNĐ (~66 triệu USD) | SOM 24 tháng: 56,5 tỷ VNĐ (~2,2 triệu USD; riêng Năm 1 đạt 5,48 tỷ VNĐ).

b. Phân tích số liệu khảo sát khách hàng và định lượng quy mô thị trường (TAM - SAM - SOM):
Thống kê nỗi đau khách hàng thực chứng:
Số liệu từ Hội Y học Giấc ngủ Việt Nam ghi nhận khoảng 30% người trưởng thành gặp phải các triệu chứng rối loạn giấc ngủ, tương đương hơn 10 triệu người; ở nhóm người cao tuổi tỷ lệ này lên tới 30% đến 40%. Theo báo cáo của Cục Thống kê và Bộ Y tế, cả nước hiện có khoảng 14,8 đến 16 triệu người từ 60 tuổi trở lên, trung bình mỗi người mắc 3 đến 4 bệnh mạn tính. Mỗi năm ghi nhận khoảng 200.000 ca đột quỵ mới nhưng chỉ 23,2% bệnh nhân đến bệnh viện kịp trong khung giờ vàng 4,5 giờ đầu; nghĩa là 76,8% bệnh nhân nhập viện muộn do không phát hiện kịp biến cố ban đêm trong lúc ngủ.

Ở phía thị trường B2B học thuật và trị liệu, cả nước hiện có hơn 240 trường đại học và viện nghiên cứu, trong đó có hơn 65 đơn vị đào tạo chuyên ngành Kỹ thuật Y sinh, Công nghệ Thông tin - Trí tuệ Nhân tạo và Y Dược đang phải nhập khẩu thiết bị đo sóng não OpenBCI của Mỹ với giá 999 USD. Tại khu vực miền Trung, theo thống kê của Sở Du lịch Đà Nẵng, địa phương hiện có khoảng 164 đến 167 cơ sở lưu trú đạt chuẩn 4 đến 5 sao, cùng với đô thị cổ Hội An tạo thành cụm hơn 220 khu nghỉ dưỡng và khách sạn cao cấp đang chuyển dịch mạnh mẽ sang mô hình du lịch chăm sóc sức khỏe và phục hồi sinh lực (Wellness Tourism).

Định lượng quy mô thị trường theo phương pháp Bottom-up:
- Tổng thị trường tiềm năng (TAM) ước đạt khoảng 16.200 tỷ VNĐ (~640 triệu USD):
Bao gồm 4,5 triệu hộ gia đình trung lưu tại các đô thị có thành viên rối loạn giấc ngủ hoặc có cha mẹ cao tuổi có bệnh nền tim mạch, huyết áp nhân với mức chi tiêu thiết bị và theo dõi sức khỏe bình quân 3,5 triệu đồng một hộ (tương đương 15.750 tỷ đồng), kết hợp với nhu cầu trang bị thiết bị đo lường sóng não và giấc ngủ tại hơn 240 trường đại học, bệnh viện và hơn 1.000 khu nghỉ dưỡng, trung tâm trị liệu trên toàn quốc (ước đạt 450 tỷ đồng).
- Thị trường phục vụ khả thi (SAM) ước đạt khoảng 1.680 tỷ VNĐ (~66 triệu USD):
Bao gồm nhánh B2C với 450.000 hộ gia đình kỹ sư, nhân sự công nghệ và tài chính trong độ tuổi 25 đến 45 tuổi tại Đà Nẵng, Hà Nội và TP. Hồ Chí Minh có cha mẹ già sống ở các tỉnh lân cận nhân với gói chi tiêu năm đầu 3.678.000 đồng (thiết bị 2.490.000 đồng cộng 12 tháng thuê bao AI 99.000 đồng), tương đương 1.655 tỷ đồng; kết hợp với nhánh B2B gồm khoảng 65 trường đại học, viện nghiên cứu kỹ thuật - y sinh và khoảng 220 khu nghỉ dưỡng 4 đến 5 sao, trung tâm tâm lý trị liệu tại miền Trung và hai đầu đất nước, tương đương 25 tỷ đồng.
- Thị trường mục tiêu tiếp cận ban đầu trong 24 tháng (SOM) ước đạt 56,5 tỷ VNĐ (~2,2 triệu USD - chiếm 3,36% SAM):
Trong năm thứ nhất (Pha 1), doanh nghiệp đặt mục tiêu khai thác 80 bộ B2B Pro Kit (doanh thu 0,71 tỷ đồng), 20 cơ sở Wellness Resort sử dụng phần mềm SaaS (doanh thu 0,36 tỷ đồng) và 1.200 hộ gia đình B2C đầu tiên tại cụm công nghệ thông tin Đà Nẵng và miền Trung (doanh thu 4,41 tỷ đồng), mang lại tổng doanh thu 5,48 tỷ đồng trong Năm 1. Bước sang năm thứ hai (Pha 2 sau khi có giấy phép TBYT), công ty mở rộng lũy kế đạt 15.000 hộ gia đình và ca thuê bao cùng 150 bộ B2B cho phòng khám, nâng tổng doanh thu khai thác trong 24 tháng lên mức 56,5 tỷ đồng.

Phân tích bản chất kinh tế phân khúc:
Khu phức hợp FPT Complex quận Ngũ Hành Sơn quy tụ 8.000 kỹ sư công nghệ thông tin, đóng góp 69% tổng kim ngạch xuất khẩu phần mềm toàn thành phố Đà Nẵng theo công bố của FPT và Báo Chính phủ. Lực lượng kỹ sư trẻ tại đây phần đông xuất thân từ các tỉnh miền Trung lân cận (Quảng Nam, Quảng Ngãi, Huế, Quảng Trị) với mức lương từ 18 đến 45 triệu đồng một tháng. Thói quen chi tiền bảo vệ sức khỏe cho cha mẹ đã được kiểm chứng qua sự kiện Ngày Phụ huynh tháng 11 và bảo hiểm FPT Care mở rộng trên ứng dụng myFPT.

Thiết kế khảo sát thực địa khách hàng mục tiêu (Primary Customer Discovery):
Dự án triển khai quy trình đo lường thực chứng trên quy mô mẫu mục tiêu N = 100 đến 150 người tại Đà Nẵng thông qua bộ công cụ khảo sát trực tuyến hai luồng neurolink_market_survey.html. Khảo sát nhằm kiểm chứng khách quan ba giả định cốt lõi: tỷ lệ lo âu về các biến cố sức khỏe ban đêm của cha mẹ ở nhóm con cái đi làm xa, khoảng giá chấp nhận được theo phương pháp Van Westendorp (OPP, RAP), và tỷ lệ người dùng ưu tiên mua đứt thiết bị 2,49 triệu đồng so với phương án đặt cọc dùng thử 1,5 triệu đồng.

c. Phản biện câu hỏi xoáy của hội đồng:
Hội đồng chất vấn: Tại sao nhóm sáng lập lại tính toán quy mô thị trường theo phương pháp Bottom-up thay vì lấy một tỷ lệ phần trăm dân số chung chung?
Phản biện: Cách tiếp cận lấy 1% hay 5% dân số là tư duy ước đoán thiếu căn cứ thực tế. Tính toán Bottom-up bắt đầu từ từng đơn vị khách hàng cụ thể có khả năng tiếp cận và sẵn sàng chi trả: 450.000 hộ gia đình kỹ sư có thu nhập khá và 65 trường đại học đào tạo y sinh. Mọi con số đều gắn liền với đơn giá sản phẩm thực tế và khả năng đáp ứng của năng lực sản xuất Fabless.

Hội đồng chất vấn: Nhánh B2B Pro Kit quy mô doanh thu nhỏ hơn B2C rất nhiều, tại sao startup lại đưa vào trọng tâm Pha 1?
Phản biện: Tuy quy mô tổng thể của B2B Pro Kit nhỏ hơn B2C, nhưng giá trị đóng góp tiền mặt trên từng đơn vị lại vượt trội. Lợi nhuận gộp 6,7 triệu đồng trên mỗi bộ B2B Pro Kit giúp startup tạo ra dòng tiền ròng ngay từ tháng đầu tiên để nuôi sống bộ máy mà không phải đốt tiền tiếp thị. B2B Pro Kit đóng vai trò đòn bẩy tài chính và bảo chứng uy tín khoa học cho sản phẩm tiêu dùng B2C mở rộng sau này.

2. Giải pháp Giá trị (Value Propositions)

a. Nội dung cô đọng dự kiến đưa lên bảng BMC:
- Cho Lab ĐH và Trung tâm Wellness (B2B Pha 1): Kit thu nhận sóng não 8 kênh giá bằng 1/3 thiết bị nhập khẩu Mỹ; Báo cáo định lượng mức độ thư giãn sóng Alpha trước - sau trị liệu cho khách VIP.
- Cho Người dùng và Con cái xa quê (B2C Pha 1): Vòng đeo ngủ điện cực khô tự học đường nền 7 đêm đầu, theo dõi nhịp sinh học và gọi điện báo động khi có lệch pha ban đêm.
- Cho Bác sĩ và Nhà nghiên cứu (Pha 1-2): Miễn phí trạm định lượng qEEG phục vụ nghiên cứu (Research-Use-Only - RUO); gán nhãn sóng não nhận Credit đổi bộ dữ liệu Data Bank và ưu tiên nhận ca tư vấn trả tiền 150.000 đồng/15 phút.
- Cho Y tế và Hãng Dược (Pha 2-3): Cảnh báo sớm tai biến ban đêm kèm khóa an toàn tPA CM[2,1]=0 sau Sandbox; Kho dữ liệu RWE tiết kiệm 80% chi phí đo PSG bệnh viện.

b. Phân tích bản chất kinh tế và dẫn chứng thực chứng:
Đối với khách hàng B2B, giá trị nằm ở khả năng tùy biến và bản địa hóa. Các nhà khoa học trong nước được tiếp cận bộ phần mềm phân tích qEEG hoàn toàn bằng tiếng Việt với các thuật toán lọc nhiễu 50Hz chuẩn điện lưới quốc gia. Đối với các Wellness Resort, phần mềm tự động xuất báo cáo PDF định dạng sang trọng mang thương hiệu riêng của resort. Báo cáo thể hiện rõ chỉ số thư giãn nhận thức trước và sau buổi trị liệu, giúp cơ sở nâng tầm dịch vụ và thuyết phục khách hàng cao cấp chi trả.

Đối với khách hàng cá nhân B2C, giá trị cốt lõi là giấc ngủ ngon và sự an tâm từ xa. Thiết bị đo trực tiếp điện thế vỏ não, ghi nhận sự biến thiên của tỷ lệ sóng chậm (DAR, TAR) và tính đối xứng bán cầu não (BSI) trong các chu kỳ ngủ sâu. Khi phát hiện các dấu hiệu bất thường vượt ngưỡng so với đường nền cá nhân hóa 7 đêm đầu, hệ thống phát tín hiệu cảnh báo đến người thân.

Đối với bác sĩ và nhà nghiên cứu, NeuroLink thiết lập cơ chế trao đổi giá trị hai chiều mang tên Gán nhãn Đổi Tín chỉ (Label-for-Credit RLHF). Các bác sĩ xác thực chứng chỉ hành nghề hoặc nghiên cứu sinh xác thực ORCID/email học thuật được sử dụng miễn phí công cụ tiền xử lý qEEG chuẩn nghiên cứu (RUO - giới hạn 30 bản ghi mỗi tháng) để dựng bản đồ não 19 kênh và xuất biểu đồ công bố quốc tế. Đổi lại, mỗi bản ghi đã khử định danh được họ gán nhãn lâm sàng sẽ cộng điểm tín chỉ (Credit) vào ví nội bộ. Tín chỉ này dùng để mở rộng hạn mức phân tích hàng loạt, tải các bộ dữ liệu nghiên cứu khác trên chợ Data Bank phục vụ luận văn, đồng thời nâng điểm uy tín học thuật để được hệ thống ưu tiên phân bổ các ca hội chẩn có trả thù lao tiền mặt 150.000 đồng/15 phút.

c. Phản biện câu hỏi xoáy của hội đồng:
Hội đồng chất vấn: Các thiết bị vòng đeo tay thông minh hiện nay đều có tính năng đo giấc ngủ, NeuroLink có gì vượt trội?
Phản biện: Đồng hồ thông minh chỉ sử dụng cảm biến gia tốc và cảm biến quang học PPG ở cổ tay. PPG phản ánh gián tiếp nhịp đập mạch máu ngoại vi, chịu sai số rất lớn khi người dùng trở mình và có độ trễ nhiều giờ so với các biến đổi thần kinh trung ương. NeuroLink đo trực tiếp điện thế hoạt động của vỏ não (EEG) qua các điện cực vùng tai, ghi nhận chính xác các pha giấc ngủ và phát hiện sớm các dấu hiệu thiếu máu cục bộ thoáng qua ngay khi vừa xuất hiện.

3. Kênh Tiếp cận theo Lộ trình Vết dầu loang 3 Pha (Channels)

a. Nội dung cô đọng dự kiến đưa lên bảng BMC:
- Pha 1 (Tháng 0-12): Bán trực tiếp B2B cho Lab ĐH và Wellness Resort (Đà Nẵng - Hội An); Kênh D2C trực tuyến (Website, Shopee Mall) kết hợp B2B2E ưu đãi cho kỹ sư CNTT (FPT Complex, KMS); Đo lâm sàng tình nguyện tại BV Đà Nẵng.
- Pha 2 (Tháng 12-24): Đưa vào chuỗi nhà thuốc Long Châu, Pharmacity và phân phối qua phòng khám chuyên khoa khi có Số lưu hành TBYT.
- Pha 3 (Tháng 24+): Cổng cấp phép dữ liệu số RWE B2B trực tuyến cho các tổ chức y tế quốc tế và đối tác bảo hiểm.

b. Phân tích bản chất kinh tế và dẫn chứng thực chứng:
Chiến lược phân phối tuân thủ nghiêm ngặt tính hợp pháp và thực tế dòng tiền. Trong 12 tháng đầu tiên, startup hoàn toàn không bán sản phẩm qua kênh kê đơn bệnh viện hay nhà thuốc y tế. Nhánh B2B được tiếp cận trực tiếp qua các hội thảo khoa học, mạng lưới cựu sinh viên Bách Khoa và các chuyến làm việc chuyên môn với ban giám đốc các khu nghỉ dưỡng trị liệu tại Hội An và Đà Nẵng.

Đối với nhánh B2C, doanh nghiệp phân phối sản phẩm dưới nhãn Thiết bị Hỗ trợ Giấc ngủ thông qua kênh bán lẻ trực tuyến D2C (Website chính thức, gian hàng thương mại điện tử Shopee Mall có chứng thực) kết hợp mô hình B2B2E. Khai thác mạng lưới cựu sinh viên Bách Khoa Đà Nẵng (DUT Alumni) giữ chức vụ quản lý tại FPT Complex và KMS để tổ chức ngày hội trải nghiệm sức khỏe nhân Ngày Phụ huynh. Doanh nghiệp không phải chi trả ngân sách công ty (tránh bẫy xuất toán thuế TNDN theo Thông tư 96/2015/TT-BTC và Luật ATVSLĐ 84/2015/QH13), nhân viên tự mua sắm bằng mã ưu đãi cá nhân.

Song song đó, startup kết nối với Hội Thầy thuốc Trẻ Đà Nẵng và Bệnh viện Đà Nẵng triển khai các đợt đo đối chứng điện não tình nguyện miễn phí cho bệnh nhân. Hoạt động này vừa tạo giá trị cộng đồng, vừa tích lũy hồ sơ kiểm định lâm sàng phục vụ quy trình cấp phép thiết bị y tế chính quy cho Pha 2.

c. Phản biện câu hỏi xoáy của hội đồng:
Hội đồng chất vấn: Tại sao không đưa ngay sản phẩm vào chuỗi nhà thuốc FPT Long Châu từ Pha 1?
Phản biện: Chuỗi nhà thuốc yêu cầu nghiêm ngặt về Số lưu hành Trang thiết bị Y tế do Bộ Y tế cấp, đồng thời áp dụng mức chiết khấu thương mại 35% đến 45%, phí niêm yết kệ hàng và công nợ 60 đến 90 ngày. Đưa sản phẩm vào chuỗi bán lẻ khi chưa có giấy phép y tế là vi phạm pháp luật; còn nếu cố tình làm khi chưa có thương hiệu sẽ dẫn đến chôn vốn và phá sản vì công nợ.

4. Quan hệ và Cơ chế Giữ chân Khách hàng (Customer Relationships)

a. Nội dung cô đọng dự kiến đưa lên bảng BMC:
- Vòng lặp RLHF Bác sĩ và B2B Portal: Bác sĩ (CCHN) và Researcher (ORCID) gán nhãn ca sạch nhiễu (đồng thuận chéo 2 người) để tích Credit đổi dữ liệu Data Bank; Resort có cổng xuất báo cáo Co-branding.
- Khóa sinh học B2C: AI học sâu đường nền 7 đêm đầu (đổi máy mất hồ sơ cá nhân hóa) kết hợp báo cáo sáng tự động gửi ứng dụng 2-3 người con.
- Tư vấn On-Demand: Kết nối chuyên gia và bác sĩ giải thích biểu đồ giấc ngủ trong vòng 2 giờ khi có cảnh báo.

b. Phân tích bản chất kinh tế và dẫn chứng thực chứng:
Tỷ lệ bỏ rơi thiết bị theo dõi sức khỏe phổ thông trên thị trường thường lên đến 60% đến 80% sau 1 đến 3 tháng. NeuroLink bẻ gãy điểm nghẽn này bằng ba cơ chế giữ chân độc quyền:

Thứ nhất là vòng lặp cộng sinh học thuật (Academic RLHF Flywheel) đã được hiện thực hóa trực tiếp trên cơ sở dữ liệu CreditWallet và NeuralTrainingSample của nền tảng. Thay vì tốn hàng tỷ đồng thuê chuyên gia y tế gán nhãn dữ liệu huấn luyện như các công ty AI truyền thống, NeuroLink biến chính nhu cầu nghiên cứu của bác sĩ nội trú và nhà khoa học thành động lực làm giàu dữ liệu. Để ngăn chặn hành vi bấm chọn nhãn bừa bãi nhằm gom tín chỉ rác (Label Farming), hệ thống áp đặt hai chốt kiểm soát tự động: bản ghi phải đạt điểm chất lượng tín hiệu từ 0,80 trở lên (loại bỏ nhiễu điện lưới 50Hz) và chỉ giải ngân Credit khi có sự đồng thuận nhãn độc lập từ tối thiểu hai chuyên gia kết hợp vượt qua các mẫu kiểm định chuẩn vàng ẩn danh. Do tín chỉ nội bộ khóa chức năng rút tiền mặt trực tiếp, startup thu về kho dữ liệu gán nhãn chuẩn lâm sàng với chi phí tiền mặt bằng 0 đồng, đồng thời khóa chặt thói quen sử dụng phần mềm của giới chuyên môn.

Đối với khách hàng B2C, cơ chế giữ chân dựa trên sự gắn kết gia đình. Mỗi sáng lúc 6h30, ứng dụng tự động gửi tóm tắt chất lượng giấc ngủ của cha mẹ đến điện thoại của 2 đến 3 người con. Nếu một đêm cha mẹ quên không đeo máy, hệ thống báo cờ chưa có dữ liệu. Con cái sẽ chủ động gọi điện nhắc nhở. Việc sử dụng máy trở thành sợi dây kết nối tình cảm gia đình.

Ngoài ra, thuật toán AI học sâu đường nền sinh học riêng của từng cá nhân trong tuần đầu tiên. Dữ liệu càng nhiều thì độ chính xác phân tích càng cao. Người dùng hiểu rằng chuyển sang thiết bị khác đồng nghĩa với việc xóa bỏ toàn bộ lịch sử nhịp não đã được hiệu chuẩn cá nhân.

c. Phản biện câu hỏi xoáy của hội đồng:
Hội đồng chất vấn: Cho bác sĩ và nhà nghiên cứu dùng miễn phí công cụ phân tích qEEG liệu có làm mất doanh thu bán phần mềm B2B và bị spam nhãn bẩn vào cơ sở dữ liệu không?
Phản biện: Gói miễn phí được đóng khung nghiêm ngặt dưới chuẩn phục vụ nghiên cứu cá nhân (Research-Use-Only, giới hạn 30 ca lẻ mỗi tháng) và hoàn toàn không tự triệt tiêu doanh thu thương mại: muốn thu sóng trực tiếp từ người thật, phòng Lab vẫn phải mua phần cứng B2B Pro Kit giá 8,9 triệu đồng; muốn xuất báo cáo mang thương hiệu riêng cho khách hàng, Resort vẫn phải trả gói SaaS 1,5 triệu đồng mỗi tháng. Về chất lượng nhãn, cơ chế đồng thuận mù hai bác sĩ (2-Reader Blind Consensus) cùng các ca bẫy chuẩn vàng gài ngầm đảm bảo lọc sạch 100% thao tác gán nhãn cẩu thả trước khi đưa vào tập huấn luyện.

5. Dòng Doanh thu 3 Động cơ (Revenue Streams)

a. Nội dung cô đọng dự kiến đưa lên bảng BMC:
- (1) B2B Pro Kit và SaaS Tổ chức: Bán Kit R&D / Wellness giá 8.900.000 đồng/bộ (lãi gộp 75,3%, tương đương 6,7 triệu đồng/bộ) + Thuê bao phần mềm báo cáo cho Resort 1.500.000 đồng/tháng (biên lãi gộp ~92%).
- (2) B2C Thiết bị Giấc ngủ: Bán đứt 2.490.000 đồng/bộ (lãi gộp 53,8%, tương đương 1.340.000 đồng/bộ) hoặc Đặt cọc dùng thử 30 ngày 1.500.000 đồng (bảo toàn vốn lưu động).
- (3) Thuê bao AI và Vật tư tiêu hao: Gói AI Gia đình 99.000 đồng/tháng (biên lãi gộp ~87% - 90%, Cloud ~6.000 đồng) + Đệm điện cực thay thế 149.000 đồng/quý (lãi gộp 73,2%) + Phí sàn tư vấn 199.000 đồng/ca (chuyên gia 150k, sàn 49k).
- (4) Dữ liệu RWE B2B (Pha 3): Cấp phép 3.000 đến 10.000 USD cho mỗi bộ dữ liệu ẩn danh chuẩn hóa.

b. Phân tích bản chất kinh tế và dẫn chứng thực chứng:
Mô hình tài chính được thiết kế để tạo dòng tiền dương ngay từ ngày đầu tiên thông qua 3 động cơ bổ trợ lẫn nhau:
Động cơ thứ nhất là B2B Pro Kit và SaaS tổ chức. Mức giá 8.900.000 đồng hoàn toàn nằm trong hạn mức giải ngân mua sắm vật tư nghiên cứu định kỳ của các lab đại học và chi phí trang thiết bị của các resort cao cấp. Với giá vốn sản xuất khoảng 2.200.000 đồng, mỗi bộ Kit mang lại 6,7 triệu đồng lợi nhuận gộp. Đi kèm với đó là gói thuê bao phần mềm xuất báo cáo định kỳ 1.500.000 đồng mỗi cơ sở mỗi tháng, chi phí máy chủ chỉ khoảng 120.000 đồng, biên lãi gộp đạt 92%.

Động cơ thứ hai là dòng sản phẩm B2C tiêu dùng. Giá bán đứt 2.490.000 đồng mang lại lãi gộp 1.340.000 đồng (53,8%). Đối với khách hàng còn ngần ngại, gói cọc dùng thử 1.500.000 đồng cao hơn giá vốn 1.150.000 đồng, giúp doanh nghiệp luôn dương tiền mặt lưu động.

Động cơ thứ ba là doanh thu định kỳ từ phần mềm và vật tư tiêu hao. Gói thuê bao 99.000 đồng một tháng là phần mềm tự động hóa 100%, không gánh lương bác sĩ cố định. Chi phí máy chủ biên khoảng 6.000 đồng, phí cổng thanh toán khoảng 7.000 đồng, công ty thu về lợi nhuận gộp khoảng 86.000 đồng mỗi tháng. Đệm điện cực bán rời 149.000 đồng một quý theo mô hình dao cạo và lưỡi dao cạo. Dịch vụ hội chẩn chuyên gia thu phí riêng 199.000 đồng mỗi lượt, chia sẻ 150.000 đồng cho bác sĩ và thu phí sàn 49.000 đồng.

c. Phản biện câu hỏi xoáy của hội đồng:
Hội đồng chất vấn: Gói thuê bao 99.000 đồng có đủ trang trải chi phí máy chủ và vận hành không?
Phản biện: Gói 99.000 đồng thuần túy là dịch vụ phần mềm đám mây (SaaS). Thuật toán AI chạy các tác vụ suy luận nhẹ trên chuỗi thời gian, chi phí máy chủ trung bình trên mỗi người dùng chỉ 6.000 đồng mỗi tháng. Startup không bao gồm chi phí bác sĩ hay vật tư trong gói này. Do đó, biên lãi gộp đạt xấp xỉ 90%, tương tự biên lợi nhuận của các dịch vụ đám mây toàn cầu.

6. Tài sản và Nguồn lực Cốt lõi (Key Resources)

a. Nội dung cô đọng dự kiến đưa lên bảng BMC:
- Phần cứng, Phần mềm và Sổ cái Tín chỉ chạy thật: Bo mạch 6 lớp ADS1299 (0 lỗi DRC) thương mại hóa ngay cho B2B Pro Kit; Trạm Web qEEG, sổ cái CreditWallet và kho lưu trữ Neural DB tự động làm giàu nhãn y khoa với chi phí tiền mặt 0 đồng.
- Thuật toán và Kiểm nghiệm mù: Bộ 80 đặc trưng bất biến độ lợi; Kiểm nghiệm mù UCLH London N=28 (BAcc 73,33% Confirmatory, 67,22% Zero-Calibration Round 2, khóa an toàn CM[2,1]=0).
- Sở hữu Trí tuệ và Thiết kế: Thiết kế công thái học vòng đeo ngủ B2C; Báo cáo phân tích mức độ thư giãn sóng não tiếng Việt độc quyền.
- Mạng lưới Học thuật và Chính sách: Liên kết các Lab Đại học kỹ thuật - y dược, Trung tâm DISSC Đà Nẵng và Hội Thầy thuốc Trẻ.

b. Phân tích bản chất kinh tế và dẫn chứng thực chứng:
Tài sản cốt lõi của NeuroLink là các kết quả nghiên cứu và kỹ thuật đã được hiện thực hóa bằng mã nguồn và sản phẩm vật lý chạy thật. Bo mạch phần cứng 6 lớp chuyên dụng cho đo điện não đã vượt qua kiểm tra tĩnh với 0 lỗi DRC, sử dụng chip chuyển đổi tương tự số sinh học TI ADS1299 kết hợp vi điều khiển nRF52 BLE.

Hệ thống trạm làm việc Web qEEG và kho cơ sở dữ liệu Neural DB đã được triển khai hoàn chỉnh tại dự án software_neuronlink_eeg, hỗ trợ hiển thị biểu đồ sóng não thời gian thực và phân tích phổ tần số. Thuật toán học máy của dự án đã trải qua kiểm nghiệm mù độc lập trên tập dữ liệu chuẩn lâm sàng UCLH London gồm 28 ca bệnh.

Mô hình đạt Balanced Accuracy 73,33% ở nhánh Confirmatory và 67,22% ở điều kiện Zero-Calibration sau đợt kiểm toán khử nhiễu phần cứng đa trung tâm Round 2. Tầng phòng vệ an toàn Stage 3 Safety Veto áp đặt điều kiện bất khả xâm phạm CM[2,1]=0, bảo đảm không có ca xuất huyết não nào bị bỏ sót dẫn đến chỉ định nhầm thuốc tiêu sợi huyết tPA.

c. Phản biện câu hỏi xoáy của hội đồng:
Hội đồng chất vấn: Các giải thuật điện não hiện nay có rất nhiều trên mã nguồn mở, NeuroLink có gì độc quyền?
Phản biện: Mã nguồn mở chỉ cung cấp các bộ lọc cơ bản. Sự khác biệt của NeuroLink nằm ở tập đặc trưng bất biến độ lợi (Gain-Invariant Metrics) gồm DAR, TAR, BSI và wPLI được chuẩn hóa để thích ứng với điện cực khô vùng tai, cùng kho dữ liệu điện não đa trạng thái đã được các chuyên gia y tế thẩm định và gán nhãn thực tế.

7. Hoạt động Trọng yếu theo Mô hình Fabless (Key Activities)

a. Nội dung cô đọng dự kiến đưa lên bảng BMC:
- Sản xuất Fabless: Quản lý chuỗi cung ứng linh kiện và hợp tác gia công đóng gói với xưởng EMS đạt chuẩn ISO 13485.
- Phát triển Bộ Kit và Phần mềm B2B: Tối ưu firmware nạp trước, cung cấp API dữ liệu thô cho Lab ĐH và phần mềm xuất báo cáo cho Wellness Resort.
- Vận hành Kênh D2C và Sàn Tư vấn: Quản lý trải nghiệm khách hàng tiêu dùng, kiểm duyệt chứng chỉ chuyên gia và điều phối thời gian nhận ca dưới 2 giờ.
- Kiểm định Lâm sàng: Phối hợp Hội đồng Đạo đức Bệnh viện Đà Nẵng đo đối chứng miễn phí để hoàn thiện hồ sơ xin cấp Số lưu hành TBYT.

b. Phân tích bản chất kinh tế và dẫn chứng thực chứng:
Doanh nghiệp vận hành theo mô hình phần cứng không xưởng (Fabless Hardware). Toàn bộ công đoạn gia công mạch in PCB, dán linh kiện SMT, đúc vỏ nhựa sinh học và đóng gói bao bì được ủy thác cho các đối tác EMS đạt chứng nhận quốc tế ISO 13485 tại Việt Nam. Cách làm này giúp công ty không phải đầu tư hàng chục tỷ đồng vào nhà xưởng máy móc mà vẫn đảm bảo chất lượng xuất xưởng đồng đều.

Đội ngũ nòng cốt tập trung vào các hoạt động có giá trị gia tăng cao nhất: hoàn thiện firmware, bảo mật truyền dữ liệu BLE, phát triển các tính năng phân tích phổ sóng não trên web và duy trì chất lượng dịch vụ sàn tư vấn. Đối với hoạt động kiểm định y tế, công ty chủ động tổ chức các đợt đo thực nghiệm tình nguyện để tích lũy dữ liệu đối chứng lâm sàng với máy đo tiêu chuẩn nội viện, chuẩn bị sẵn sàng hồ sơ kỹ thuật cho giai đoạn xin cấp phép.

c. Phản biện câu hỏi xoáy của hội đồng:
Hội đồng chất vấn: Không sở hữu nhà máy sản xuất thì startup kiểm soát chất lượng linh kiện và tiến độ giao hàng như thế nào?
Phản biện: Hợp đồng hợp tác với các nhà máy EMS chuẩn ISO 13485 quy định rõ quy trình kiểm tra chức năng tự động 100% trước khi xuất xưởng (In-Circuit Testing và Functional Testing). Mọi bo mạch lỗi đều bị loại bỏ ngay trên dây chuyền. Startup nắm giữ firmware mã hóa nạp sau cùng, đảm bảo bảo mật thiết kế và chất lượng sản phẩm xuất xưởng.

8. Liên minh Đối tác Chiến lược (Key Partners)

a. Nội dung cô đọng dự kiến đưa lên bảng BMC:
- Khối Học thuật và Wellness (Thương mại ngay): Khoa Kỹ thuật Y sinh / CNTT các trường Đại học; Wellness Resort và Trung tâm Tâm lý - Trị liệu Giấc ngủ tại Đà Nẵng - Hội An.
- Khối Chính sách và Mở đường Lâm sàng: Trung tâm DISSC (Sở KH&CN Đà Nẵng - đầu mối vốn NQ 19 và Sandbox NQ 136), Vườn ươm DNES, Hội Thầy thuốc Trẻ Đà Nẵng và Bệnh viện Đà Nẵng.
- Khối Sản xuất: Nhà máy gia công điện tử y tế EMS đạt chuẩn quản lý chất lượng ISO 13485.
- Khối Phân phối Pha 2: Chuỗi nhà thuốc bán lẻ FPT Long Châu, Pharmacity khi hoàn tất giấy phép TBYT.

b. Phân tích bản chất kinh tế và dẫn chứng thực chứng:
Chiến lược xây dựng đối tác dựa trên nguyên tắc liên minh với những đơn vị có thể tạo ra doanh thu hoặc giá trị pháp lý ngay lập tức mà không bị vướng mắc giấy phép y tế. Các trường đại học lớn như Đại học Bách Khoa và các trường thành viên Đại học Đà Nẵng là khách hàng mua sắm thiết bị phục vụ giảng dạy và nghiên cứu khoa học.

Về mặt chính sách địa phương, Trung tâm Hỗ trợ Khởi nghiệp Đổi mới Sáng tạo Đà Nẵng (DISSC) thuộc Sở Khoa học và Công nghệ là cơ quan đầu mối hướng dẫn thực hiện chính sách hỗ trợ khởi nghiệp đổi mới sáng tạo theo Nghị quyết 19/2026/NQ-HĐND và tham mưu cơ chế thử nghiệm có kiểm soát (Sandbox) theo Nghị quyết 136/2024/QH15. Vườn ươm Doanh nghiệp Đà Nẵng (DNES) hỗ trợ hoàn thiện mô hình kinh doanh và kết nối các quỹ đầu tư mầm.

Về mặt lâm sàng, sự đồng hành của Hội Thầy thuốc Trẻ Đà Nẵng và các bác sĩ Bệnh viện Đà Nẵng tạo điều kiện thuận lợi để triển khai các nghiên cứu quan sát trên người tình nguyện dưới sự chấp thuận của Hội đồng Đạo đức y sinh học, mở đường cho việc cấp phép y tế chính thức.

c. Phản biện câu hỏi xoáy của hội đồng:
Hội đồng chất vấn: Các khu nghỉ dưỡng Wellness Resort có thực sự cần thiết bị đo sóng não không hay chỉ là dịch vụ thêm thắt?
Phản biện: Xu hướng du lịch phục hồi sức khỏe cao cấp đòi hỏi sự minh bạch và kiểm chứng khoa học. Khách hàng cao cấp chi trả hàng chục triệu đồng cho một kỳ nghỉ dưỡng không chỉ muốn nghe tư vấn cảm tính. Họ muốn nhìn thấy số liệu đo đạc khách quan cho thấy mức độ cải thiện giấc ngủ và sóng thư giãn của não bộ. NeuroLink cung cấp chính xác công cụ định lượng mà các resort đang tìm kiếm để khẳng định đẳng cấp dịch vụ.

9. Cấu trúc Chi phí Biến đổi hóa (Cost Structure)

a. Nội dung cô đọng dự kiến đưa lên bảng BMC:
- Giá vốn Thiết bị: Kit B2B Pro ~2.200.000 đồng/bộ (chiếm 24,7% giá bán); Thiết bị B2C Sleep ~1.150.000 đồng/bộ (chiếm 46,2% giá bán).
- Chi phí Đám mây và Thanh toán: Server xử lý tín hiệu ~6.000 đồng/người dùng/tháng; Phí cổng thanh toán trực tuyến ~7% trên mỗi giao dịch.
- Chia sẻ Thù lao Chuyên gia và Gán nhãn AI: 150.000 đồng/ca tư vấn (chiếm 75,4% giá dịch vụ, 0 đồng lương cứng cố định); 0 đồng tiền mặt mua nhãn dữ liệu nhờ trả thưởng bằng Credit nội bộ.
- Tiếp thị và Thử nghiệm: Ngân sách tiếp thị số D2C, tham gia hội thảo khoa học và chi phí đo đối chứng lâm sàng (tài trợ từ dòng tiền B2B và ngân sách NQ 19).

b. Phân tích bản chất kinh tế và dẫn chứng thực chứng:
Mô hình tài chính triệt tiêu tối đa các khoản chi phí cố định (Fixed Cost) để bảo đảm sức chịu đựng bền bỉ cho doanh nghiệp. Công ty không duy trì đội ngũ bác sĩ cơ hữu trả lương tháng cố định. Chi phí chuyên gia hoàn toàn là chi phí biến đổi, chỉ phát sinh khi khách hàng yêu cầu đọc ca và thanh toán phí dịch vụ.

Chi phí sản xuất phần cứng biến thiên trực tiếp theo đơn đặt hàng thực tế từ khách hàng B2B và B2C. Hạ tầng máy chủ đám mây được tối ưu hóa kiến trúc, chỉ tính tiền theo lưu lượng truy vấn thực tế.

Điểm hòa vốn vận hành của bộ máy cực kỳ thấp: Chi phí cố định tối thiểu của doanh nghiệp (thuê không gian làm việc chung, kế toán và máy chủ cơ sở dữ liệu) chỉ dao động khoảng 60 đến 80 triệu đồng một tháng. Doanh nghiệp chỉ cần bán được 10 đến 12 bộ B2B Pro Kit (lãi gộp 67 đến 80 triệu đồng) hoặc duy trì khoảng 800 thuê bao phần mềm B2C đang hoạt động là đã đạt điểm hòa vốn tiền mặt mà không cần trợ lực tài chính từ bên ngoài.

c. Phản biện câu hỏi xoáy của hội đồng:
Hội đồng chất vấn: Chi phí kiểm định lâm sàng và đăng ký thiết bị y tế loại C rất đắt đỏ, startup lấy tiền đâu để chi trả?
Phản biện: Chi phí này được phân bổ làm 2 nguồn đối ứng rõ ràng: Thứ nhất là trích từ lợi nhuận gộp tích lũy của nhánh thương mại B2B Pro Kit và bán lẻ B2C Wellness trong 12 tháng đầu. Thứ hai là tiếp cận gói tài trợ không hoàn lại tối đa 2 tỷ đồng từ chính sách hỗ trợ dự án khởi nghiệp đổi mới sáng tạo theo Nghị quyết 19/2026/NQ-HĐND của thành phố Đà Nẵng, giúp giảm áp lực vốn đối với doanh nghiệp.

10. Chân bảng: Tính Bền vững và Đòn bẩy Chính sách Đặc thù Đà Nẵng

a. Nội dung cô đọng dự kiến đưa lên bảng BMC:
- Lộ trình Pháp lý 2 Bước Không Bị Chặn: Pha 1 bán hợp pháp 100% dưới dạng B2B Research Kit và B2C General Wellness Sleep Device (theo Nghị định 98/2021/NĐ-CP và 07/2023/NĐ-CP, không quảng cáo chẩn đoán đột quỵ).
- Cơ chế Thử nghiệm Sandbox Đà Nẵng: Đầu mối DISSC - Sở KH&CN Đà Nẵng đăng ký Sandbox theo Nghị quyết 136/2024/QH15 tại Bệnh viện Đà Nẵng để hoàn tất thử nghiệm lâm sàng cấp phép TBYT cảnh báo đột quỵ ở Pha 2.
- Đòn bẩy Tài chính và Ưu đãi Thuế: Tiếp cận gói hỗ trợ tối đa 2 tỷ đồng theo Nghị quyết 19/2026/NQ-HĐND thành phố Đà Nẵng; Miễn 100% thuế Thu nhập Doanh nghiệp trong 5 năm đầu cho doanh nghiệp khởi nghiệp đổi mới sáng tạo.

b. Phân tích bản chất kinh tế và dẫn chứng thực chứng:
Khung chính sách đặc thù của thành phố Đà Nẵng là lợi thế cạnh tranh mang tính nền tảng cho NeuroLink. Nghị quyết số 136/2024/QH15 của Quốc hội về thí điểm tổ chức chính quyền đô thị và một số cơ chế, chính sách đặc thù phát triển thành phố Đà Nẵng tạo hành lang pháp lý mở cho việc thử nghiệm các giải pháp công nghệ cao và y tế thông minh chưa có tiền lệ. Thông qua đầu mối là Trung tâm Hỗ trợ Khởi nghiệp Đổi mới Sáng tạo (DISSC) thuộc Sở Khoa học và Công nghệ, startup được tạo điều kiện đưa thiết bị vào thử nghiệm trong môi trường y tế có kiểm soát tại Bệnh viện Đà Nẵng.

Đi kèm với đó là chính sách tài trợ trực tiếp không hoàn lại tối đa 2 tỷ đồng theo Nghị quyết số 19/2026/NQ-HĐND của Hội đồng Nhân dân thành phố Đà Nẵng dành cho các nhiệm vụ nghiên cứu phát triển và hoàn thiện sản phẩm công nghệ cao. Ngoài ra, chính sách miễn 100% thuế TNDN trong 5 năm đầu đối với doanh nghiệp khởi nghiệp sáng tạo giúp giữ lại toàn bộ thặng dư tiền mặt để tái đầu tư vào hoạt động nghiên cứu khoa học.

Về mặt phân loại lưu hành, việc tách bạch lộ trình sản phẩm giúp công ty hoạt động hoàn toàn hợp pháp. Ở Pha 1, thiết bị được đăng ký theo đúng quy định của Nghị định 98/2021/NĐ-CP và Nghị định 07/2023/NĐ-CP với bản chất là thiết bị hỗ trợ theo dõi giấc ngủ thông thường (Wellness Device), giúp tạo lập doanh thu ngay từ ngày đầu. Khi hoàn tất thử nghiệm trong Sandbox y tế, sản phẩm mới chính thức đăng ký mở rộng tính năng cảnh báo đột quỵ thuộc danh mục TBYT chuyên dụng ở Pha 2.

c. Phản biện câu hỏi xoáy của hội đồng:
Hội đồng chất vấn: Nếu quy trình xin phép vào Sandbox Đà Nẵng bị chậm trễ thì hoạt động kinh doanh của công ty có bị đình trệ không?
Phản biện: Hoàn toàn không. Nhờ kiến trúc Động cơ Kép, nhánh thương mại B2B Pro Kit cho các trường đại học và nhánh B2C thiết bị giấc ngủ Wellness vẫn vận hành kinh doanh bình thường và đem lại dòng tiền dương độc lập. Sandbox là bước đệm gia tăng giá trị y tế chứ không phải là điều kiện tiên quyết để công ty tồn tại trong năm đầu tiên.

III. BẢNG TÍNH KINH TẾ ĐƠN VỊ (UNIT ECONOMICS) VÀ KẾ HOẠCH KHẢO NGHIỆM THỊ TRƯỜNG

1. Bảng hạch toán biên lợi nhuận đơn vị, LTV 24 tháng và CAC

Dưới đây là bảng phân rã chi tiết cơ cấu doanh thu, chi phí biến đổi và biên lợi nhuận gộp trên toàn bộ các dòng sản phẩm, dịch vụ của NeuroLink trong mô hình Động cơ Kép:

| Cấu phần Sản phẩm / Dịch vụ | Mức giá Niêm yết (VNĐ) | Giá vốn / Biến phí (VNĐ) | Lãi gộp Đơn vị (VNĐ) | Biên Lãi gộp (%) | Cơ chế Vận hành và Kiểm soát Chi phí |
|---|---|---|---|---|---|
| (1) B2B Research & Wellness Kit | 8.900.000 đ | 2.200.000 đ | 6.700.000 đ | 75,3% | Kit 8 kênh kèm API, phụ kiện đo lường, phần mềm qEEG; bán cho Lab ĐH và Resort |
| (1b) SaaS Báo cáo cho Resort | 1.500.000 đ/tháng | 120.000 đ (Server B2B) | 1.380.000 đ/tháng | 92,0% | Phần mềm xuất báo cáo định lượng sóng não thương hiệu riêng cho Resort / Wellness Center |
| (1c) Trạm qEEG Học thuật (RUO) | 0 đ (Đổi nhãn) | ~1.500 đ/ca (Compute) | +1 Nhãn chuẩn y khoa | 0 đ tiền mặt | Bác sĩ/Researcher gán nhãn (đồng thuận 2 người) nhận Credit nội bộ đổi Data Bank, 0 đ chi phí mua nhãn |
| (2) B2C Thiết bị Giấc ngủ (Bán đứt) | 2.490.000 đ | 1.150.000 đ | 1.340.000 đ | 53,8% | Mạch 6 lớp, cảm biến điện cực khô vùng tai, gia công EMS chuẩn y tế ISO 13485 |
| (2b) Đặt cọc Dùng thử 30 ngày | 1.500.000 đ (cọc) | 1.150.000 đ (COGS) | Dòng tiền bảo toàn | Hoàn cọc | Khách trả máy hoàn cọc; cọc cao hơn giá vốn 350k giúp bảo toàn 100% vốn lưu động |
| (3) Thuê bao AI An Tâm Báo Hiếu | 99.000 đ/tháng | 13.000 đ (Cloud + Cổng) | 86.000 đ/tháng | 86,9% | 100% AI tự động học Baseline, cảnh báo lệch pha đêm; 0 đồng lương bác sĩ cố định |
| (4) Hộp đệm điện cực (Định kỳ quý) | 149.000 đ/hộp | 40.000 đ | 109.000 đ/hộp | 73,2% | Vật tư tiêu hao thay sau 90 đêm đảm bảo trở kháng tiếp xúc da dưới 10 kOhm |
| (5) Sàn Hội chẩn Chuyên gia Theo Ca | 199.000 đ/ca | 150.000 đ (Bác sĩ) + 5.000 đ hạ tầng | 44.000 đ/ca | 22,1% | Bác sĩ nhận 75,4% thù lao theo ca, NeuroLink thu phí sàn công nghệ 24,6% |

Phân tích giá trị vòng đời khách hàng B2C (Customer Lifetime Value - LTV) trong 24 tháng:
- Lợi nhuận gộp từ bán phần cứng ban đầu: 1.340.000 đồng
- Lợi nhuận gộp từ thuê bao phần mềm AI (24 tháng x 86.000 đồng): 2.064.000 đồng
- Lợi nhuận gộp từ vật tư tiêu hao hộp đệm (7 quý thay mới x 109.000 đồng): 763.000 đồng
- Lợi nhuận gộp từ phí sàn đọc ca bác sĩ (ước tính bảo thủ 2 ca/24 tháng x 44.000 đồng): 88.000 đồng
- Tổng LTV lý thuyết tích lũy trong 24 tháng trên một hộ gia đình: 4.255.000 đồng (khoảng 4.265.000 đồng nếu tính phí sàn 49.000 đồng).
- Mức LTV bảo thủ tính toán theo tỷ lệ khấu hao và rời bỏ tự nhiên 12% mỗi năm: khoảng 3.996.000 đồng.

Chỉ số chi phí thu hút khách hàng (CAC) và thời gian hoàn vốn B2C:
- Chi phí thu hút một khách hàng (CAC bình quân): 350.000 đến 500.000 đồng một hộ.
+ Chi phí kênh B2B2E phân bổ qua gian hàng trải nghiệm Ngày Phụ huynh: khoảng 350.000 đồng một khách hàng.
+ Chi phí tiếp thị trực tuyến D2C có định hướng: khoảng 500.000 đồng một khách hàng.
- Tỷ số LTV trên CAC:
Tỷ số LTV / CAC = 3.996.000 đồng / 500.000 đồng = 8,0x (vượt xa chuẩn khuyến nghị 3,0x của ngành phần mềm y tế).
- Thời gian thu hồi vốn CAC (CAC Payback Period): Ngay tháng thứ nhất.
Khoản lãi gộp phần cứng 1.340.000 đồng ngay khi bán đã hoàn trả chi phí tiếp thị 500.000 đồng và tạo ra thặng dư tiền mặt 840.000 đồng ngay tại thời điểm xuất kho.

Điểm hòa vốn vận hành toàn diện (Break-even Analysis):
- Chi phí định phí vận hành tinh gọn của bộ máy: khoảng 70.000.000 đồng/tháng (văn phòng không gian chia sẻ, dịch vụ kế toán kiểm toán, máy chủ cơ sở dữ liệu và chi phí hành chính).
- Kịch bản hòa vốn 1 (Thuần B2B): Chỉ cần bán 11 bộ B2B Pro Kit mỗi tháng (lợi nhuận gộp 11 x 6.700.000 = 73.700.000 đồng) là đủ bù đắp 100% chi phí vận hành toàn công ty.
- Kịch bản hòa vốn 2 (Thuần B2C): Cần duy trì khoảng 815 thuê bao AI đang hoạt động thường xuyên (815 x 86.000 đồng = 70.090.000 đồng).
- Kịch bản hòa vốn thực tế (Kết hợp Động cơ Kép): Chỉ cần bán 5 bộ B2B Pro Kit (lãi gộp 33,5 triệu đồng), 10 cơ sở Resort dùng SaaS (lãi gộp 13,8 triệu đồng) và 300 thuê bao B2C (lãi gộp 25,8 triệu đồng) là đạt ngưỡng sinh lời ròng dương hàng tháng.

2. Ngưỡng kiểm chứng chuyển pha (Milestone Gates) và Khảo sát định giá Van Westendorp PSM

Ngưỡng chuyển giao giữa các giai đoạn được kiểm soát bằng các chỉ số định lượng bắt buộc:
- Ngưỡng Gate 1 (Từ Pha 1 sang Pha 2):
+ Đạt doanh số tối thiểu 50 bộ B2B Pro Kit và 1.000 thiết bị B2C hoạt động thường xuyên.
+ Tỷ lệ duy trì sử dụng sau 90 ngày (D90 Retention) đạt từ 70% trở lên.
+ Thời gian nhận ca trung vị của chuyên gia trên sàn (Median Time-to-Claim) dưới 2 giờ.
+ Hoàn thành bộ hồ sơ nghiên cứu lâm sàng quan sát đối chứng với máy điện não nội viện tại Bệnh viện Đà Nẵng, đạt chứng nhận 0 lỗi PHI.
+ Được Hội đồng Đạo đức và Sở Khoa học Công nghệ Đà Nẵng phê duyệt tham gia cơ chế Sandbox theo Nghị quyết 136/2024/QH15.

- Ngưỡng Gate 2 (Từ Pha 2 sang Pha 3):
+ Quy mô người dùng thường xuyên đạt từ 15.000 thuê bao gia đình.
+ Được Bộ Y tế cấp Số lưu hành Trang thiết bị Y tế chính thức cho tính năng hỗ trợ chẩn đoán và cảnh báo nguy cơ thần kinh.
+ Tích lũy tối thiểu 50.000 giờ dữ liệu điện não ban đêm chuẩn hóa được gán nhãn lâm sàng.
+ Thiết lập thỏa thuận hợp tác thương mại chính thức với ít nhất một chuỗi bán lẻ dược phẩm lớn (FPT Long Châu hoặc Pharmacity) và một công ty bảo hiểm nhân thọ.

Phương pháp khảo nghiệm độ nhạy cảm giá Van Westendorp (PSM):
Dự án đang triển khai công cụ khảo sát thực địa trực tuyến với 4 câu hỏi chuẩn hóa Van Westendorp trên hai nhóm đối tượng:
- Luồng A (Con cái - Người chi trả): Xác định điểm giá tối ưu (Optimum Price Point - OPP), điểm giá trung hòa (Indifference Price Point - IDP) và khoảng giá chấp nhận được (Range of Acceptable Prices - RAP) cho gói thiết bị giấc ngủ B2C và gói thuê bao 99.000 đồng.
- Luồng B (Bác sĩ và Chuyên gia - Người cung cấp dịch vụ): Đo lường mức thù lao tối thiểu chấp nhận được và mức thù lao kỳ vọng cho một phiên đọc bản ghi điện não 15 phút ngoài giờ.
Kết quả thu thập thực tế sẽ được dùng để hiệu chỉnh các chính sách chiết khấu và ưu đãi trước khi chính thức mở bán quy mô lớn tại sự kiện Ngày Phụ huynh tháng 11.
