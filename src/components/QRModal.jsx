import { useEffect } from 'react'
import { QRCode } from 'react-qrcode-logo'

/**
 * Props:
 *   service  - service object
 *   onClose  - callback to close the modal
 */
export default function QRModal({ service, onClose }) {
  const domain   = import.meta.env.VITE_APP_DOMAIN || window.location.origin
  const checkInUrl = `${domain}/checkin?s=${service.id}`

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleCopy = () => {
    navigator.clipboard.writeText(checkInUrl)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-brand-border rounded-2xl w-full max-w-sm p-8 animate-slide-up shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl font-semibold text-brand-text">{service.name}</h2>
            <p className="text-brand-muted text-sm mt-1">{service.date} · {service.time}</p>
          </div>
          <button
            onClick={onClose}
            className="text-brand-muted hover:text-brand-text transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-xl p-4">
            <QRCode
              value={checkInUrl}
              size={200}
              qrStyle="dots"
              eyeRadius={6}
              fgColor="#0A0A0A"
              bgColor="#FFFFFF"
              logoImage="/global_black.png"
              logoWidth={48}
              logoHeight={48}
              logoPaddingStyle="circle"
              removeQrCodeBehindLogo
            />
          </div>
        </div>

        {/* URL + copy */}
        <div className="bg-brand-bg border border-brand-border rounded-lg p-3 flex items-center gap-2">
          <p className="text-brand-muted text-xs font-mono flex-1 truncate">{checkInUrl}</p>
          <button
            onClick={handleCopy}
            className="text-gold hover:text-gold-light transition-colors text-xs font-semibold whitespace-nowrap"
          >
            Copy link
          </button>
        </div>

        <p className="text-brand-subtle text-xs text-center mt-4">
          Members can scan this QR code or follow the link to check in.
        </p>

        <button onClick={onClose} className="btn-gold w-full mt-5">
          Done
        </button>
      </div>
    </div>
  )
}
