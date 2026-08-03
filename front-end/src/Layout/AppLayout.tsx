import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-app">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden ">
        <Header />
        <main className="flex-1 overflow-y-auto ">{/* รอใส่ outlet */}</main>
      </div>
    </div>
  );
}
