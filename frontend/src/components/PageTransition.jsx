import { motion } from 'framer-motion';

export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const pageTransition = {
  duration: 0.25,
  ease: "easeOut",
};

export default function PageTransition({ children }) {
  return (
    <motion.div
      className="page-transition-container"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  );
}
