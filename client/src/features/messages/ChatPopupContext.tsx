import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '../../api/endpoints';

interface ChatPopupContextValue {
  isOpen: boolean;
  isMinimized: boolean;
  activeConvId: string | null;
  isStartingChat: boolean;
  openInbox: () => void;
  togglePopup: () => void;
  openConversation: (convId: string) => void;
  startChatWithUser: (targetUserId: string) => Promise<void>;
  minimizePopup: () => void;
  closePopup: () => void;
}

const ChatPopupContext = createContext<ChatPopupContextValue | null>(null);

export function ChatPopupProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);

  const openInbox = useCallback(() => {
    setIsOpen(true);
    setIsMinimized(false);
    setActiveConvId(null);
  }, []);

  const togglePopup = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else if (isMinimized) {
      setIsMinimized(false);
    } else {
      setIsOpen(false);
    }
  }, [isOpen, isMinimized]);

  const openConversation = useCallback((convId: string) => {
    setActiveConvId(convId);
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const startChatWithUser = useCallback(
    async (targetUserId: string) => {
      setIsStartingChat(true);
      try {
        const res = await messagesApi.startConversation(targetUserId);
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        setActiveConvId(res.conversation.id);
        setIsOpen(true);
        setIsMinimized(false);
      } finally {
        setIsStartingChat(false);
      }
    },
    [queryClient],
  );

  const minimizePopup = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const closePopup = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const value = useMemo<ChatPopupContextValue>(
    () => ({
      isOpen,
      isMinimized,
      activeConvId,
      isStartingChat,
      openInbox,
      togglePopup,
      openConversation,
      startChatWithUser,
      minimizePopup,
      closePopup,
    }),
    [
      isOpen,
      isMinimized,
      activeConvId,
      isStartingChat,
      openInbox,
      togglePopup,
      openConversation,
      startChatWithUser,
      minimizePopup,
      closePopup,
    ],
  );

  return <ChatPopupContext.Provider value={value}>{children}</ChatPopupContext.Provider>;
}

export function useChatPopup() {
  const ctx = useContext(ChatPopupContext);
  if (!ctx) {
    throw new Error('useChatPopup must be used inside ChatPopupProvider');
  }
  return ctx;
}
