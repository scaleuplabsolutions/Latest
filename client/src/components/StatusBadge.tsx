import React from 'react';
import { getStatusColor } from '@/lib/expiryUtils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const formattedStatus = status.toLowerCase();
  const colorClasses = getStatusColor(formattedStatus);
  
  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClasses} ${className}`}>
      {formattedStatus === 'good' ? 'Good' : 
       formattedStatus === 'expired' ? 'Expired' : 
       formattedStatus === 'expiring-soon' ? 'Expiring Soon' :
       formattedStatus === 'short-dated' ? 'Short-dated' : status}
    </span>
  );
};

export default StatusBadge;
