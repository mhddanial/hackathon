export default function ChatWidget() {
  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white shadow-lg rounded-xl border border-slate-200 flex flex-col h-96">
      <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
        <h3 className="font-semibold">AI Assistant</h3>
      </div>
      <div className="flex-1 p-4">
        <p className="text-slate-500 text-sm text-center mt-10">Chat interface akan dirender di sini</p>
      </div>
      <div className="p-3 border-t border-slate-200">
        <input type="text" placeholder="Tanya sesuatu..." className="w-full border border-slate-300 rounded p-2 text-sm" disabled />
      </div>
    </div>
  )
}
