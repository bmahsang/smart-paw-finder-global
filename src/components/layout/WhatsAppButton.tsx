import { useEffect, useState } from 'react';
import { X, Send } from 'lucide-react';

const WHATSAPP_NUMBER = '15559433437';
const DISMISS_KEY = 'wa_bubble_dismissed';

export function WhatsAppButton() {
  const [showBubble, setShowBubble] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    const t = setTimeout(() => setShowBubble(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const dismissBubble = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sessionStorage.setItem(DISMISS_KEY, '1');
    setShowBubble(false);
  };

  const handleSend = () => {
    const text = message.trim() || 'Hi BITE ME!';
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-20 right-6 z-50 flex items-end gap-2">
      {showBubble && (
        <div className="group relative mb-1 flex flex-col rounded-2xl bg-white pl-4 pr-8 py-3 shadow-lg ring-1 ring-black/5 text-sm text-gray-800 animate-in fade-in slide-in-from-right-2 duration-300 leading-tight max-w-[260px]">
          <span className="font-medium">💬 Say hi on WhatsApp</span>
          <span className="block mt-0.5 text-gray-500 text-xs">Send us a message anytime!</span>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 text-xs rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/30 transition-colors"
            />
            <button
              onClick={handleSend}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a] transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={dismissBubble}
            aria-label="Dismiss"
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <button
        onClick={() => setShowBubble(!showBubble)}
        aria-label="Chat on WhatsApp"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 hover:bg-[#20bd5a] active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </button>
    </div>
  );
}
