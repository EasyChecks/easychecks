/**
 * Shared dynamic import for EventMap.
 * Both LocationManagement and EventManagementTab must import from here
 * so that only one dynamic() wrapper is created — preventing duplicate
 * map instances and ensuring BoundsFitter's useEffect fires correctly.
 */
import dynamic from 'next/dynamic';

const DynamicEventMap = dynamic(() => import('@/components/admin/EventMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-125 bg-gray-100 rounded-2xl">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-b-2 border-orange-600 rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500">กำลังโหลดแผนที่...</p>
      </div>
    </div>
  ),
});

export default DynamicEventMap;
