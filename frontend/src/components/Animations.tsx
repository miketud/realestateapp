// src/components/Animations.tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';

/* --------------------------- NoProperties --------------------------- */
export function NoProperties() {
  useEffect(() => {
    const audio = new Audio('/sounds/wind8bit.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => null);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        height: 200,
        width: '100%',
      }}
    >
      <svg width="320" height="160" viewBox="0 0 320 160">
        {/* Desert ground */}
        <motion.rect
          x="0"
          y="120"
          width="320"
          height="20"
          fill="#5c5954ff"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />

        {/* Completed house */}
        <motion.path
          d="M210 95 L230 80 L250 95 L250 120 L210 120 Z"
          fill="#a8987a"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.35, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        />

        {/* Half-built structure */}
        <motion.g
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 0.4, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          stroke="#9b8d73"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        >
          <motion.line x1="90" y1="120" x2="120" y2="120" />
          <motion.line x1="90" y1="120" x2="90" y2="90" />
          <motion.line x1="120" y1="120" x2="120" y2="95" />
          <motion.line x1="90" y1="90" x2="105" y2="78" />
          <motion.line x1="105" y1="78" x2="120" y2="95" />
          <motion.line x1="90" y1="105" x2="120" y2="105" />
        </motion.g>

        {/* Sign post */}
        <motion.rect
          x="50"
          y="80"
          width="6"
          height="40"
          fill="#7a6243"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        />
        <motion.rect
          x="30"
          y="80"
          width="45"
          height="12"
          rx="2"
          fill="#cfc0b0ff"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        />
        <motion.text
          x="53"
          y="89"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fill="#372f25"
          opacity="0.8"
        >
          FOR SALE
        </motion.text>

        {/* Tumbleweed */}
        <motion.g
          initial={{ x: -60, rotate: 0 }}
          animate={{ x: 360, rotate: 720 }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
        >
          <motion.circle cx="0" cy="115" r="10" stroke="#8a6a40" strokeWidth="2" fill="none" />
          <motion.circle cx="0" cy="115" r="7" stroke="#a57d4c" strokeWidth="1.5" fill="none" />
        </motion.g>

        {/* Floating dust */}
        {Array.from({ length: 14 }).map((_, i) => {
          const x = 20 + Math.random() * 280;
          const y = 115 + Math.random() * 10;
          const size = 1 + Math.random() * 2;
          const delay = Math.random() * 3;
          const duration = 3 + Math.random() * 2;
          return (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={size}
              fill="#bca67a"
              initial={{ opacity: 0, y: 0 }}
              animate={{
                opacity: [0, 0.5, 0],
                y: [-8 - Math.random() * 6, -10],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          );
        })}
      </svg>
    </div>
  );
}

/* --------------------------- NoContacts --------------------------- */
export function NoContacts() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
        width: '100%',
        background: 'transparent',
      }}
    >
      <svg
        width="320"
        height="180"
        viewBox="0 0 320 180"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tree trunk */}
        <path
          d="M160 150 Q158 110 155 70 Q150 60 145 45"
          stroke="#6a3c20"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />

        {/* Visible main branches */}
        <path
          d="M155 80 Q140 65 130 55 M155 90 Q170 75 185 60 M155 100 Q145 90 130 85 M155 105 Q170 90 180 85"
          stroke="#6a3c20"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Canopy leaves — clustered */}
        {Array.from({ length: 25 }).map((_, i) => {
          const cx = 135 + Math.random() * 50; // tighter canopy range
          const cy = 40 + Math.random() * 45;
          const colorPool = ['#e5b85b', '#d48b42', '#c6652e', '#e0a64f'];
          const color = colorPool[Math.floor(Math.random() * colorPool.length)];
          return (
            <circle
              key={`leaf-${i}`}
              cx={cx}
              cy={cy}
              r={5 + Math.random() * 2}
              fill={color}
              opacity={0.9}
            />
          );
        })}

        {/* Ground layer leaves (fallen) */}
        {Array.from({ length: 10 }).map((_, i) => {
          const gx = 130 + Math.random() * 60;
          const gy = 158 + Math.random() * 4;
          const colorPool = ['#e5b85b', '#d48b42', '#c6652e'];
          const color = colorPool[Math.floor(Math.random() * colorPool.length)];
          return (
            <ellipse
              key={`ground-${i}`}
              cx={gx}
              cy={gy}
              rx="3.5"
              ry="2"
              fill={color}
              transform={`rotate(${Math.random() * 40 - 20} ${gx} ${gy})`}
            />
          );
        })}

        {/* Falling leaves constrained to canopy area */}
        {Array.from({ length: 6 }).map((_, i) => {
          const startX = 50 + Math.random() * 50; // within tree width
          const startY = 20 + Math.random() * 35;  // within canopy height
          const colorPool = ['#e5b85b', '#d48b42', '#c6652e'];
          const color = colorPool[Math.floor(Math.random() * colorPool.length)];
          const drift = Math.random() > 0.5 ? 1 : -1;
          return (
            <motion.ellipse
              key={`falling-${i}`}
              cx={startX}
              cy={startY}
              rx="3.5"
              ry="2"
              fill={color}
              initial={{ opacity: 0, x: startX, y: startY }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [startY, 160],
                x: [startX, startX + 20 * drift],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 7 + Math.random() * 3,
                delay: i * 1.3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          );
        })}

     </svg>
    </div>
  );
}
