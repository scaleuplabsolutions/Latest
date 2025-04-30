import { useSystemContext } from '@/context/SystemContext';

export const useSystemType = () => {
  const { systemType, setSystemType } = useSystemContext();

  return {
    systemType,
    setSystemType,
    isStore: systemType === 'store',
    isWarehouse: systemType === 'warehouse',
    getSystemName: () => systemType === 'store' ? 'Store System' : 'Warehouse System',
    getSystemIcon: () => systemType === 'store' ? 'store' : 'warehouse',
  };
};
