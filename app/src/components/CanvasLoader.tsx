import { motion, AnimatePresence } from "framer-motion";

interface CanvasLoaderProps {
  visible: boolean;
  progress?: number;
}

export function CanvasLoader({ visible }: CanvasLoaderProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="canvas-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="canvas-spinner" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
