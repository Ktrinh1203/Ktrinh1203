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
    metaTitle: 'NeuroLink — Hiểu rõ sức khỏe não bộ',
    nav: {
      primaryAria: 'Điều hướng chính',
      mobileAria: 'Điều hướng di động',
      footerAria: 'Điều hướng chân trang',
      why: 'Vì sao NeuroLink',
      signal: 'Tín hiệu & Thiết bị',
      experience: 'Trải nghiệm',
      signIn: 'Đăng nhập',
      getStarted: 'Bắt đầu ngay',
      openWorkspace: 'Vào Bảng tin',
      langToggleLabel: 'Chọn ngôn ngữ',
      menuOpenLabel: 'Mở menu điều hướng',
      menuCloseLabel: 'Đóng menu điều hướng',
      skipToContent: 'Chuyển tới nội dung chính',
    },
    hero: {
      headline: 'Hiểu rõ sức khỏe não bộ.',
      support:
        'Theo dõi giấc ngủ và sự tỉnh táo hằng ngày, xem tín hiệu sóng não thật và kết nối với bác sĩ xác minh trong một không gian nhẹ nhàng.',
      primaryCta: 'Khám phá NeuroLink',
      primaryCtaAuthed: 'Vào Bảng tin',
      scrollCta: 'Xem câu chuyện',
      imageAlt:
        'Người phụ nữ đeo vòng đeo cảm biến vải mềm tối giản trong ánh sáng ban mai ấm áp và thư thái.',
    },
    why: {
      headline: 'Chăm sóc não bộ không nên mù mờ hay xa cách.',
      body: 'Thông tin về giấc ngủ và sức khỏe não bộ trên mạng thường rời rạc, dễ gây nhiễu, trong khi việc đo sóng não chuyên sâu lại khó tiếp cận ngoài các bệnh viện lớn. Đồng thời, bác sĩ và nhà nghiên cứu vẫn thiếu một không gian chung để trao đổi. NeuroLink kết nối việc theo dõi hằng ngày, hình ảnh sóng não dễ hiểu và sự đồng hành của chuyên gia vào một nơi tin cậy.',
      imageAlt:
        'Tác phẩm đồ họa tối giản hình bóng khuôn mặt và những dải sóng xanh ngọc dịu nhẹ trên nền xanh rừng sâu.',
    },
    signal: {
      headline: 'Từ tín hiệu tinh tế đến sự thấu hiểu.',
      lead: 'Nguyên mẫu vòng đeo cảm biến ngoài da không xâm lấn ghi nhận các tín hiệu nhỏ bé và biến chúng thành biểu đồ sóng não rõ ràng cho việc tự theo dõi và tham vấn bác sĩ.',
      studioImageAlt:
        'Ảnh studio nguyên mẫu vòng đeo vải xám kèm hộp thu tín hiệu nhôm bạc phủ xanh và dây cảm biến tiếp xúc ngoài da.',
      macroImageAlt:
        'Ảnh cận cảnh các điện cực tiếp xúc tròn bằng kim loại mịn gắn trên dây đeo vải xanh xám của nguyên mẫu NeuroLink.',
      waveLabel: 'Minh họa nhịp sóng Alpha êm dịu',
      waveCaption: 'Nhịp sóng Alpha êm dịu',
      prototypeNote:
        'Lưu ý minh bạch: Đây là nguyên mẫu nghiên cứu cảm biến ngoài da không xâm lấn — chưa thương mại hóa và không phải thiết bị chẩn đoán y khoa.',
    },
    ecosystem: {
      headline: 'Một hệ sinh thái kết nối.',
      lead: 'Được thiết kế cho từng người dùng, bác sĩ và nhà nghiên cứu cùng đồng hành chăm sóc sức khỏe não bộ.',
      closingNote:
        'Chung một nền tảng — tự điều chỉnh trải nghiệm phù hợp với từng vai trò.',
      items: [
        {
          id: 'general',
          role: 'Người dùng phổ thông',
          description:
            'Theo dõi giấc ngủ và độ tỉnh táo hằng ngày, xem các bản ghi sóng não mẫu hoặc cá nhân và gửi câu hỏi tới bác sĩ xác minh.',
          image: '/landing/story/persona-user.jpg',
          imageAlt:
            'Người dùng trẻ thư giãn bên cửa sổ ngập nắng sớm trong không gian sống yên tĩnh.',
        },
        {
          id: 'doctor',
          role: 'Bác sĩ & Chuyên gia',
          description:
            'Tiếp nhận các ca tư vấn sóng não từ xa được người dùng chia sẻ và đưa ra hướng dẫn y khoa rõ ràng, đáng tin cậy.',
          image: '/landing/story/persona-doctor.jpg',
          imageAlt:
            'Nữ bác sĩ mỉm cười thân thiện trong áo blouse trắng tại phòng khám sáng thoáng và ấm áp.',
        },
        {
          id: 'researcher',
          role: 'Nhà nghiên cứu & Sinh viên',
          description:
            'Cùng trao đổi kiến thức khoa học thần kinh và khám phá các bộ dữ liệu sóng não đã ẩn danh trong một cộng đồng mở.',
          image: '/landing/story/persona-researcher.jpg',
          imageAlt:
            'Nhà nghiên cứu trẻ đang xem lại bản ghi sóng não và ghi chép bên bàn gỗ nhiều ánh sáng tự nhiên.',
        },
      ],
    },
    experience: {
      headline: 'Trải nghiệm NeuroLink',
      lead: 'Ảnh chụp thực tế từ ứng dụng web máy tính và phiên bản di động đang vận hành.',
      desktopBadge: 'Web Máy tính',
      mobileBadge: 'Web Di động',
      tabsLabel: 'Chọn màn hình trải nghiệm',
      items: [
        {
          id: 'brainwave',
          tabLabel: 'Xem sóng não',
          title: 'Biểu đồ sóng não và bản đồ trực quan',
          caption:
            'Quan sát các dải sóng não nhiều kênh cùng bản đồ vùng hoạt động đồng bộ trên cả máy tính và điện thoại.',
          desktopImage: '/landing/desktop-qeeg-stroke.png',
          desktopAlt:
            'Giao diện xem sóng não NeuroLink trên máy tính hiển thị các đường sóng và bản đồ vùng não trực quan.',
          desktopPath: 'neurolink · Xem sóng não',
          mobileImage: '/landing/mobile-qeeg.png',
          mobileAlt:
            'Màn hình web di động NeuroLink hiển thị biểu đồ sóng não rõ nét và các dải tần số.',
        },
        {
          id: 'guidance',
          tabLabel: 'Hỏi đáp Bác sĩ',
          title: 'Gửi câu hỏi tới bác sĩ đã xác minh',
          caption:
            'Đính kèm thông tin sóng não vào câu hỏi tư vấn một cách mạch lạc, kèm nhắc nhở an toàn khi cần hỗ trợ khẩn cấp.',
          desktopImage: '/landing/desktop-consultations.png',
          desktopAlt:
            'Giao diện Hỏi đáp Bác sĩ trên máy tính hiển thị danh sách ca tư vấn và hướng dẫn an toàn.',
          desktopPath: 'neurolink · Hỏi đáp Bác sĩ',
          mobileImage: '/landing/mobile-consult.png',
          mobileAlt:
            'Danh sách câu hỏi tư vấn bác sĩ trên web di động NeuroLink.',
        },
        {
          id: 'community',
          tabLabel: 'Cộng đồng Y khoa',
          title: 'Trao đổi chuyên môn trong không gian bình tĩnh',
          caption:
            'Theo dõi các chủ đề sức khỏe não bộ, đọc chia sẻ từ chuyên gia và trò chuyện trực tiếp mọi lúc.',
          desktopImage: '/landing/desktop-feed.png',
          desktopAlt:
            'Bảng tin Cộng đồng Y khoa NeuroLink trên máy tính với bài viết từ các bác sĩ xác minh.',
          desktopPath: 'neurolink · Cộng đồng Y khoa',
          mobileImage: '/landing/mobile-feed.png',
          mobileAlt:
            'Bảng tin Cộng đồng Y khoa trên giao diện web di động NeuroLink.',
        },
      ],
    },
    ctaFooter: {
      headline: 'Bắt đầu hành trình chăm sóc não bộ rõ ràng hơn.',
      support:
        'Tham gia nhanh chóng để theo dõi giấc ngủ, xem tín hiệu sóng não và trò chuyện cùng các chuyên gia tin cậy.',
      primaryCta: 'Tham gia ngay',
      primaryCtaAuthed: 'Vào Bảng tin',
      secondaryCta: 'Đăng nhập',
      brandTagline: 'Hiểu rõ sức khỏe não bộ, tín hiệu và chăm sóc tin cậy.',
      disclaimer:
        'NeuroLink hỗ trợ theo dõi sức khỏe cá nhân, học tập và định hướng ban đầu — không thay thế chẩn đoán tại bệnh viện hay dịch vụ cấp cứu 115.',
      links: {
        why: 'Vì sao NeuroLink',
        signal: 'Tín hiệu & Thiết bị',
        experience: 'Trải nghiệm',
        signIn: 'Đăng nhập',
        register: 'Bắt đầu ngay',
        workspace: 'Vào Bảng tin',
      },
    },
  },
};
