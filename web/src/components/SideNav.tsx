import { NavLink } from "react-router-dom";

const items = [
  { to: "/skills/global", label: "Global", desc: "全局 skill（机器级共享 + demo）" },
  { to: "/skills/projects", label: "Project Skills", desc: "项目 skill（按项目分组）" },
  { to: "/router", label: "Router", desc: "模拟 prompt 命中（M2）" },
  { to: "/run", label: "Run", desc: "跑 skillctl 命令（M3）" },
  { to: "/settings", label: "Settings", desc: "路径 / 端口 配置（M3）" },
];

export function SideNav() {
  return (
    <nav className="flex w-52 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) =>
            `block rounded px-3 py-2 transition ${
              isActive
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`
          }
        >
          <div className="text-sm font-medium">{it.label}</div>
          <div className="mt-0.5 text-xs font-normal text-slate-400">{it.desc}</div>
        </NavLink>
      ))}
    </nav>
  );
}
