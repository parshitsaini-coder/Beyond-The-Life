export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#9ea9ab]">
      <div className="bg-white p-8 rounded-3xl shadow-md w-full max-w-sm text-center">
        <h1 className="text-xl font-bold mb-4 text-gray-800">Login to BTL Panel</h1>
        <p className="text-xs text-gray-500 mb-6">Enter your credentials to continue</p>
        <button className="w-full py-2.5 bg-[#1f2222] text-white rounded-xl text-xs font-semibold">
          Sign In
        </button>
      </div>
    </div>
  );
}
