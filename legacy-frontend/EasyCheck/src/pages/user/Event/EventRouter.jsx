import React from "react";
import { Routes, Route } from "react-router-dom";
import EventList from "./EventList";
import EventDetails from "./EventDetails";

// Router สำหรับส่วน Event ของ User (ใช้ EventContext)
export default function EventRouter() {
  return (
    <Routes>
      <Route path="/" element={<EventList />} />      {/* /event */}
      <Route path=":id" element={<EventDetails />} /> {/* /event/1 */}
    </Routes>
  );
}