import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { ChatRole } from '@/store/session';

/**
 * One conversation turn. The user's voice wears the primary/teal; the agent speaks on a
 * calm surface bubble. Generous line height per DESIGN_SYSTEM.md.
 */
export function MessageBubble({
  role,
  children,
}: {
  role: ChatRole;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const isUser = role === 'user';
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[88%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
          isUser
            ? 'rounded-br-md bg-primary text-primary-fg shadow-card'
            : 'rounded-bl-md bg-surface text-ink shadow-card ring-1 ring-border',
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}
