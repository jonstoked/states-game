import styles from './ShareModal.module.css'

interface ShareModalProps {
  stateSlug: string
  stateName: string
  score: number
  onClose: () => void
}

export function ShareModal({ stateSlug, stateName, score, onClose }: ShareModalProps) {
  const challengeUrl = `${window.location.origin}/${stateSlug}`

  const handleShare = async () => {
    const text = `I scored ${score}/100 drawing ${stateName} on States Game! Can you do better?`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'States Drawing Game', text, url: challengeUrl })
      } else {
        await navigator.clipboard.writeText(`${text}\n${challengeUrl}`)
        alert('Challenge link copied to clipboard!')
      }
    } catch {
      // User cancelled or share failed — silently ignore
    }
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className={styles.title}>Challenge a Friend</h2>
        <p className={styles.description}>
          Share your {stateName} challenge and see if anyone can beat your score of{' '}
          <strong className={styles.score}>{score}</strong>!
        </p>
        <div className={styles.urlBox}>
          <span className={styles.url}>{challengeUrl}</span>
        </div>
        <button className={styles.shareBtn} onClick={handleShare}>
          {navigator.share ? 'Share' : 'Copy Link'}
        </button>
      </div>
    </div>
  )
}
