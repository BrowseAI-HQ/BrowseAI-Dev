import { useState, useEffect, useCallback } from "react";

const TYPING_SPEED = 80;
const DELETING_SPEED = 40;
const PAUSE_AFTER_TYPING = 2000;
const PAUSE_AFTER_DELETING = 500;

export function useTypewriter(phrases: string[]) {
  const [text, setText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const tick = useCallback(() => {
    const currentPhrase = phrases[phraseIndex];

    if (!isDeleting) {
      if (text.length < currentPhrase.length) {
        return TYPING_SPEED;
      }
      setIsDeleting(true);
      return PAUSE_AFTER_TYPING;
    }

    if (text.length > 0) {
      return DELETING_SPEED;
    }
    setIsDeleting(false);
    setPhraseIndex((prev) => (prev + 1) % phrases.length);
    return PAUSE_AFTER_DELETING;
  }, [text, phraseIndex, isDeleting, phrases]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const currentPhrase = phrases[phraseIndex];
      if (!isDeleting) {
        if (text.length < currentPhrase.length) {
          setText(currentPhrase.slice(0, text.length + 1));
        }
      } else {
        if (text.length > 0) {
          setText(text.slice(0, -1));
        }
      }
    }, tick());

    return () => clearTimeout(timeout);
  }, [text, phraseIndex, isDeleting, tick, phrases]);

  return text;
}
