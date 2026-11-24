export type LandingLang = 'en' | 'vi';

export type ExperienceTabId = 'brainwave' | 'guidance' | 'community';

export interface EcosystemPersona {
  id: 'general' | 'doctor' | 'researcher';
  role: string;
  description: string;
  image: string;
  imageAlt: string;
}

export interface ExperienceItem {
  id: ExperienceTabId;
  tabLabel: string;
  title: string;
  caption: string;
  desktopImage: string;
  desktopAlt: string;
  desktopPath: string;
  mobileImage: string;
  mobileAlt: string;
}

export interface LandingCopy {
  metaTitle: string;
  nav: {
    primaryAria: string;
    mobileAria: string;
    footerAria: string;
    why: string;
    signal: string;
    experience: string;
    signIn: string;
    getStarted: string;
    openWorkspace: string;
    langToggleLabel: string;
    menuOpenLabel: string;
    menuCloseLabel: string;
    skipToContent: string;
  };
  hero: {
    headline: string;
    support: string;
    primaryCta: string;
    primaryCtaAuthed: string;
    scrollCta: string;
    imageAlt: string;
  };
  why: {
    headline: string;
    body: string;
    imageAlt: string;
  };
  signal: {
    headline: string;
    lead: string;
    studioImageAlt: string;
    macroImageAlt: string;
    waveLabel: string;
    waveCaption: string;
    prototypeNote: string;
  };
  ecosystem: {
    headline: string;
    lead: string;
    closingNote: string;
    items: EcosystemPersona[];
  };
  experience: {
    headline: string;
    lead: string;
    desktopBadge: string;
    mobileBadge: string;
    tabsLabel: string;
    items: ExperienceItem[];
  };
  ctaFooter: {
    headline: string;
    support: string;
    primaryCta: string;
    primaryCtaAuthed: string;
    secondaryCta: string;
    brandTagline: string;
    disclaimer: string;
    links: {
      why: string;
      signal: string;
      experience: string;
      signIn: string;
      register: string;
      workspace: string;
    };
  };
}

export const LANDING_COPY: Record<LandingLang, LandingCopy> = {
  en: {
    metaTitle: 'NeuroLink — Clarity for your brain health',
    nav: {
      primaryAria: 'Primary navigation',
      mobileAria: 'Mobile navigation',
      footerAria: 'Footer navigation',
      why: 'Why NeuroLink',
      signal: 'Signal & Device',
      experience: 'Experience',
      signIn: 'Sign In',
      getStarted: 'Get Started',
      openWorkspace: 'Open Feed',
      langToggleLabel: 'Select language',
      menuOpenLabel: 'Open navigation menu',
      menuCloseLabel: 'Close navigation menu',
      skipToContent: 'Skip to main content',
    },
    hero: {
      headline: 'Clarity for your brain health.',
      support:
        'Follow your daily sleep and focus, explore real brainwave signals, and connect with verified specialists in one calm ecosystem.',
      primaryCta: 'Get Started',
      primaryCtaAuthed: 'Open Feed',
      scrollCta: 'Discover the story',
      imageAlt:
        'Woman wearing a soft minimalist fabric brain-sensing headband in warm natural morning light.',
    },
    why: {
      headline: "Brain health shouldn't feel distant or confusing.",
      body: 'Everyday advice about sleep and focus is noisy and scattered, while clinical brainwave testing remains bulky and hard to reach outside major medical centers. Meanwhile, doctors and researchers still lack one shared space to review signals together. NeuroLink brings personal tracking, readable brainwaves, and trusted care into one calm place.',
      imageAlt:
        'Minimalist silhouette profile with luminous emerald waves flowing smoothly across a deep forest background.',
    },
    signal: {
      headline: 'From subtle signals to human understanding.',
      lead: 'Our non-invasive headband concept gently reads surface signals and translates them into clear brainwave views for everyday awareness and specialist guidance.',
      studioImageAlt:
        'Studio view of the NeuroLink research prototype headband, compact silver and sage sensor module, and braided sensor leads.',
      macroImageAlt:
        'Close-up macro photograph of smooth silver and gold surface sensor discs mounted on a woven sage headband.',
      waveLabel: 'Calm Alpha rhythm illustration',
      waveCaption: 'Gentle Alpha rhythm',
      prototypeNote:
        'Research prototype concept: non-invasive skin-surface sensor — not commercially available and not a cleared medical diagnostic device.',
    },
    ecosystem: {
      headline: 'One connected ecosystem.',
      lead: 'Built for the everyday people, doctors, and researchers shaping calmer brain care together.',
      closingNote: 'One shared platform — adapting naturally to each person.',
      items: [
        {
          id: 'general',
          role: 'General Users',
          description:
            'Track daily sleep and alertness, explore sample or personal brainwave recordings, and ask verified doctors clear questions.',
          image: '/landing/story/persona-user.jpg',
          imageAlt:
            'Young adult resting peacefully beside a sunlit window in a calm home setting.',
        },
        {
          id: 'doctor',
          role: 'Healthcare Professionals',
          description:
            'Review remote brainwave consultation cases shared by users and provide thoughtful, trustworthy clinical guidance.',
          image: '/landing/story/persona-doctor.jpg',
          imageAlt:
            'Smiling physician in a white coat and sage shirt inside a warm, bright clinic.',
        },
        {
          id: 'researcher',
          role: 'Researchers & Students',
          description:
            'Exchange insights on neuroscience and explore de-identified brainwave datasets together in one open community.',
          image: '/landing/story/persona-researcher.jpg',
          imageAlt:
            'Neuroscience researcher reviewing printed brainwave traces and handwritten notes at a wooden desk.',
        },
      ],
    },
    experience: {
      headline: 'Experience NeuroLink',
      lead: 'Real views captured from the live desktop workspace and mobile companion.',
      desktopBadge: 'Desktop Web',
      mobileBadge: 'Mobile Web',
      tabsLabel: 'Select a NeuroLink view',
      items: [
        {
          id: 'brainwave',
          tabLabel: 'Brainwave View',
          title: 'Readable waveforms and surface brain maps',
          caption:
            'Explore multi-channel brainwave patterns alongside a clear color-coded head map across desktop and mobile.',
          desktopImage: '/landing/desktop-qeeg-stroke.png',
          desktopAlt:
            'NeuroLink desktop brainwave viewer displaying multi-channel wave traces and a 2D head map.',
          desktopPath: 'neurolink · Brainwave View',
          mobileImage: '/landing/mobile-qeeg.png',
          mobileAlt:
            'NeuroLink mobile screen displaying clean brainwave traces and frequency summaries.',
        },
        {
          id: 'guidance',
          tabLabel: 'Specialist Guidance',
          title: 'Direct questions to verified doctors',
          caption:
            'Share brainwave summaries and personal context in one structured consultation flow with built-in urgent care guidance.',
          desktopImage: '/landing/desktop-consultations.png',
          desktopAlt:
            'NeuroLink desktop consultation workspace showing specialist Q&A threads and safety notices.',
          desktopPath: 'neurolink · Specialist Guidance',
          mobileImage: '/landing/mobile-consult.png',
          mobileAlt:
            'NeuroLink mobile consultation list showing active questions and status updates.',
        },
        {
          id: 'community',
          tabLabel: 'Clinical Community',
          title: 'Calm discussions backed by real specialists',
          caption:
            'Follow brain health topics, read clinician notes, and connect directly with verified professionals across devices.',
          desktopImage: '/landing/desktop-feed.png',
          desktopAlt:
            'NeuroLink desktop clinical community feed showing specialist posts and active doctors.',
          desktopPath: 'neurolink · Clinical Community',
          mobileImage: '/landing/mobile-feed.png',
          mobileAlt:
            'NeuroLink mobile community feed with topic filters and clean navigation.',
        },
      ],
    },
    ctaFooter: {
      headline: 'A clearer view of your brain health starts here.',
      support:
        'Join in moments to follow your rest, explore brainwave signals, and connect with verified specialists.',
      primaryCta: 'Join NeuroLink',
      primaryCtaAuthed: 'Open Feed',
      secondaryCta: 'Sign in',
      brandTagline: 'Clarity for brain health, signals, and trusted care.',
      disclaimer:
        'NeuroLink supports personal wellness tracking, learning, and early guidance. It is not a medical diagnostic device and does not replace hospital diagnosis or emergency services (115).',
      links: {
        why: 'Why NeuroLink',
        signal: 'Signal & Device',
        experience: 'Experience',
        signIn: 'Sign In',
        register: 'Get Started',
        workspace: 'Open Feed',
      },
    },
  },
  vi: {
    metaTitle: 'NeuroLink — Chăm sóc sức khỏe não bộ rõ ràng hơn mỗi ngày',
    nav: {
      primaryAria: 'Điều hướng chính',
      mobileAria: 'Điều hướng di động',
      footerAria: 'Điều hướng chân trang',
      why: 'Về NeuroLink',
      signal: 'Thiết bị',
      experience: 'Giao diện',
      signIn: 'Đăng nhập',
      getStarted: 'Bắt đầu',
      openWorkspace: 'Vào Bảng tin',
      langToggleLabel: 'Chọn ngôn ngữ',
      menuOpenLabel: 'Mở menu điều hướng',
      menuCloseLabel: 'Đóng menu điều hướng',
      skipToContent: 'Chuyển tới nội dung chính',
    },
    hero: {
      headline: 'Chăm sóc não bộ, nhẹ nhàng và rõ ràng hơn.',
      support:
        'Theo dõi giấc ngủ và mức độ tập trung mỗi ngày, xem nhịp sóng não dễ hiểu và hỏi ý kiến bác sĩ đã được xác thực ngay trên một ứng dụng.',
      primaryCta: 'Bắt đầu ngay',
      primaryCtaAuthed: 'Vào Bảng tin',
      scrollCta: 'Tìm hiểu thêm',
      imageAlt:
        'Người dùng đeo vòng cảm biến vải mềm tối giản trong ánh sáng tự nhiên buổi sáng.',
    },
    why: {
      headline: 'Chăm sóc sức khỏe não bộ không nên quá khó hiểu.',
      body: 'Thông tin về giấc ngủ hay căng thẳng trên mạng thường thiếu nhất quán, còn đo điện não chuyên sâu lại chủ yếu chỉ có ở bệnh viện lớn. Trong khi đó, bác sĩ và người nghiên cứu cũng cần một nơi trao đổi chuyên môn thuận tiện hơn. NeuroLink gom việc theo dõi hằng ngày, hình ảnh sóng não dễ đọc và tư vấn từ bác sĩ về chung một chỗ.',
      imageAlt:
        'Hình ảnh minh họa nhịp sóng não trên nền xanh đậm tối giản.',
    },
    signal: {
      headline: 'Đọc nhịp sóng não dễ hiểu ngay tại nhà.',
      lead: 'Nguyên mẫu vòng đeo cảm biến ngoài da không xâm lấn giúp ghi nhận tín hiệu điện não nhẹ nhàng, hiển thị thành biểu đồ trực quan để bạn tự theo dõi hoặc gửi bác sĩ xem trước.',
      studioImageAlt:
        'Nguyên mẫu thiết bị đo điện não ngoài da tối giản gồm vòng đeo vải mềm và mô-đun cảm biến nhỏ gọn.',
      macroImageAlt:
        'Ảnh chụp cận cảnh sắc nét các điện cực khô ngoài da gắn trên dây vải kỹ thuật.',
      waveLabel: 'Minh họa nhịp sóng Alpha',
      waveCaption: 'Nhịp sóng Alpha khi thư giãn',
      prototypeNote:
        'Nguyên mẫu nghiên cứu không xâm lấn — hiện đang hoàn thiện, chưa thương mại hóa và không thay thế chẩn đoán y khoa.',
    },
    ecosystem: {
      headline: 'Dành cho mọi người cùng quan tâm đến não bộ.',
      lead: 'Từ người muốn ngủ ngon hơn mỗi tối, bác sĩ chuyên khoa cho đến sinh viên và nhà nghiên cứu thần kinh.',
      closingNote:
        'Cùng một ứng dụng — giao diện tự điều chỉnh gọn gàng theo đúng nhu cầu của bạn.',
      items: [
        {
          id: 'general',
          role: 'Người dùng hằng ngày',
          description:
            'Ghi lại giấc ngủ và độ tỉnh táo mỗi ngày, xem biểu đồ sóng não dễ đọc và gửi câu hỏi tới bác sĩ đã được xác thực.',
          image: '/landing/story/persona-user.jpg',
          imageAlt:
            'Người trẻ nghỉ ngơi thư giãn bên cửa sổ tràn ngập ánh nắng sớm trong không gian yên tĩnh.',
        },
        {
          id: 'doctor',
          role: 'Bác sĩ & Chuyên gia',
          description:
            'Xem nhanh hồ sơ sóng não người dùng chia sẻ từ xa và phản hồi hướng dẫn y khoa rõ ràng, đúng trọng tâm.',
          image: '/landing/story/persona-doctor.jpg',
          imageAlt:
            'Bác sĩ mặc áo blouse trắng mỉm cười thân thiện trong phòng khám sáng thoáng.',
        },
        {
          id: 'researcher',
          role: 'Nhà nghiên cứu & Sinh viên',
          description:
            'Thảo luận kiến thức thần kinh và tra cứu các bộ dữ liệu sóng não đã ẩn danh trong cộng đồng mở.',
          image: '/landing/story/persona-researcher.jpg',
          imageAlt:
            'Nhà nghiên cứu thần kinh xem bản in đường sóng não và ghi chép bên bàn gỗ.',
        },
      ],
    },
    experience: {
      headline: 'Trải nghiệm đồng bộ trên web và điện thoại.',
      lead: 'Giao diện thực tế đang vận hành — rộng rãi trên máy tính, gọn nhẹ khi mang theo trên điện thoại.',
      desktopBadge: 'Bản web máy tính',
      mobileBadge: 'Ứng dụng di động',
      tabsLabel: 'Chọn màn hình trải nghiệm',
      items: [
        {
          id: 'brainwave',
          tabLabel: 'Theo dõi sóng não',
          title: 'Xem sóng não trực quan trên cả hai thiết bị',
          caption:
            'Biểu đồ sóng não 6 kênh và các chỉ số cơ bản hiển thị rõ ràng, đồng bộ từ máy tính sang điện thoại.',
          desktopImage: '/landing/desktop-qeeg-stroke.png',
          desktopAlt:
            'Giao diện xem sóng não trên máy tính hiển thị biểu đồ 6 kênh và bản đồ vùng não trực quan.',
          desktopPath: 'neurolink · Theo dõi sóng não',
          mobileImage: '/landing/mobile-qeeg.png',
          mobileAlt:
            'Màn hình ứng dụng di động hiển thị biểu đồ sóng não và các chỉ số cơ bản.',
        },
        {
          id: 'guidance',
          tabLabel: 'Hỏi đáp bác sĩ',
          title: 'Gửi câu hỏi kèm kết quả sóng não tới bác sĩ',
          caption:
            'Đính kèm bản ghi sóng não trực tiếp vào câu hỏi tư vấn, kèm cảnh báo an toàn khi có dấu hiệu cần đi khám sớm.',
          desktopImage: '/landing/desktop-consultations.png',
          desktopAlt:
            'Giao diện hỏi đáp bác sĩ trên máy tính hiển thị danh sách câu hỏi tư vấn kèm cảnh báo an toàn.',
          desktopPath: 'neurolink · Hỏi đáp bác sĩ',
          mobileImage: '/landing/mobile-consult.png',
          mobileAlt:
            'Danh sách câu hỏi tư vấn bác sĩ và trạng thái phản hồi trên màn hình điện thoại.',
        },
        {
          id: 'community',
          tabLabel: 'Cộng đồng y khoa',
          title: 'Trao đổi chuyên môn trong môi trường tin cậy',
          caption:
            'Đọc bài chia sẻ đã kiểm duyệt, thảo luận ca lâm sàng và cập nhật kiến thức sức khỏe não bộ cùng chuyên gia.',
          desktopImage: '/landing/desktop-feed.png',
          desktopAlt:
            'Bảng tin cộng đồng y khoa trên máy tính với các bài chia sẻ đã kiểm duyệt từ chuyên gia.',
          desktopPath: 'neurolink · Cộng đồng y khoa',
          mobileImage: '/landing/mobile-feed.png',
          mobileAlt:
            'Bảng tin cộng đồng y khoa gọn nhẹ trên giao diện điện thoại.',
        },
      ],
    },
    ctaFooter: {
      headline: 'Bắt đầu theo dõi sức khỏe não bộ ngay hôm nay.',
      support:
        'Tạo tài khoản trong vài giây để ghi lại giấc ngủ, xem thử biểu đồ sóng não và kết nối với bác sĩ.',
      primaryCta: 'Tạo tài khoản',
      primaryCtaAuthed: 'Vào Bảng tin',
      secondaryCta: 'Đăng nhập',
      brandTagline: 'Theo dõi sóng não dễ hiểu, kết nối bác sĩ tin cậy.',
      disclaimer:
        'Các thông tin về phần cứng đề cập đến nguyên mẫu nghiên cứu đang phát triển. NeuroLink không thay thế chẩn đoán hay điều trị y khoa.',
      links: {
        why: 'Về NeuroLink',
        signal: 'Thiết bị',
        experience: 'Giao diện',
        signIn: 'Đăng nhập',
        register: 'Bắt đầu',
        workspace: 'Vào Bảng tin',
      },
    },
  },
};
