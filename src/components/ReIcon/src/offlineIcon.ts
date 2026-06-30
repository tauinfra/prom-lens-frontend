// 这里存放本地图标，在 src/layout/environment.vue 文件中加载，避免在首启动加载
import { getSvgInfo } from "@pureadmin/utils";
import { addIcon } from "@iconify/vue/dist/offline";

// https://icon-sets.iconify.design/ep/?keyword=ep
import EpHomeFilled from "~icons/ep/home-filled?raw";

// https://icon-sets.iconify.design/ri/?keyword=ri
import RiSearchLine from "~icons/ri/search-line?raw";
import RiInformationLine from "~icons/ri/information-line?raw";
import RiNotification3Line from "~icons/ri/notification-3-line?raw";
import RiLink from "~icons/ri/link?raw";
import RiFileSearchLine from "~icons/ri/file-search-line?raw";
import RiLoginBoxLine from "~icons/ri/login-box-line?raw";
import RiClipboardLine from "~icons/ri/clipboard-line?raw";
import RiUserLine from "~icons/ri/user-line?raw";
import RiAlarmWarningLine from "~icons/ri/alarm-warning-line?raw";
import RiBarChartGroupedLine from "~icons/ri/bar-chart-grouped-line?raw";
import LogosPrometheus from "~icons/logos/prometheus?raw";

const icons = [
  // Element Plus Icon: https://github.com/element-plus/element-plus-icons
  ["ep/home-filled", EpHomeFilled],
  // Remix Icon: https://github.com/Remix-Design/RemixIcon
  ["ri/search-line", RiSearchLine],
  ["ri/information-line", RiInformationLine],
  ["ri/notification-3-line", RiNotification3Line],
  ["ri/link", RiLink],
  ["ri/file-search-line", RiFileSearchLine],
  ["ri/login-box-line", RiLoginBoxLine],
  ["ri/clipboard-line", RiClipboardLine],
  ["ri/user-line", RiUserLine],
  ["ri/alarm-warning-line", RiAlarmWarningLine],
  ["ri/bar-chart-grouped-line", RiBarChartGroupedLine],
  ["logos/prometheus", LogosPrometheus]
];

// 本地菜单图标，后端在路由的 icon 中返回对应的图标字符串并且前端在此处使用 addIcon 添加即可渲染菜单图标
icons.forEach(([name, icon]) => {
  addIcon(name as string, getSvgInfo(icon as string));
});
