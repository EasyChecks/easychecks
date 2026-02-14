"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from '@/components/ui/card';
import LocationManagement from '@/components/admin/LocationManagement';
import EventManagementTab from '@/components/admin/EventManagementTab';

export default function MappingAndEventsPage() {
  const [activeTab, setActiveTab] = useState<'locations' | 'events'>('locations');

  return (
    <div className="min-h-screen p-4 bg-slate-50 sm:p-6">
      <Card className="p-6 border border-orange-100 shadow-sm">
        {/* Header */}
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            จัดการแผนที่และกิจกรรม
          </h1>
          <p className="mt-1 text-sm text-gray-500">จัดการพื้นที่เช็คอินและงานกิจกรรมต่างๆ</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'locations' | 'events')} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="locations">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              พื้นที่เช็คอิน
            </TabsTrigger>
            <TabsTrigger value="events">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              งานกิจกรรม
            </TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="mt-0">
            <LocationManagement />
          </TabsContent>

          <TabsContent value="events" className="mt-0">
            <EventManagementTab />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
