import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownProps {
  targetTimeStr: string; // HH:MM
}

const Countdown: React.FC<CountdownProps> = ({ targetTimeStr }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const [targetHours, targetMinutes] = targetTimeStr.split(':').map(Number);
      
      const target = new Date();
      target.setHours(targetHours, targetMinutes, 0, 0);

      // Handle crossing midnight
      if (target.getTime() < now.getTime()) {
         if (now.getHours() > 20 && targetHours < 12) {
             target.setDate(target.getDate() + 1);
         }
      }

      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        return '곧 도착/출발';
      }

      const minutes = Math.floor((diff / 1000) / 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      // Urgent if less than 10 minutes
      setIsUrgent(minutes < 10);

      return `${minutes}분 ${seconds}초`;
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    setTimeLeft(calculateTimeLeft()); // Initial call

    return () => clearInterval(timer);
  }, [targetTimeStr]);

  return (
    <div className={`flex items-center space-x-2 font-mono text-xl font-bold ${isUrgent ? 'text-red-500 animate-pulse' : 'text-brandBlue'}`}>
      <Clock className="w-5 h-5" />
      <span>{timeLeft}</span>
    </div>
  );
};

export default Countdown;