export function RouterPage() {
  return <Placeholder name="Router 模拟器" />;
}

function Placeholder({ name }: { name: string }) {
  return (
    <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      <div className="mb-2 text-base font-medium text-slate-700">{name}</div>
      <div>M2 — 待实现</div>
    </div>
  );
}
