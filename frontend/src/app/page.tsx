import MapView from "@/components/MapView";
import RouteForm from "@/components/RouteForm";
import ResultPanel from "@/components/ResultPanel";
import ChatWidget from "@/components/ChatWidget";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col md:flex-row gap-4">
        {/* Left Column: Form and Map */}
        <div className="flex-1 flex flex-col gap-4">
          <RouteForm />
          <div className="flex-1 relative">
            <MapView />
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="w-full md:w-96 flex flex-col gap-4">
          <ResultPanel />
        </div>
      </div>
      
      {/* Floating Chat Widget */}
      <ChatWidget />
    </main>
  );
}
