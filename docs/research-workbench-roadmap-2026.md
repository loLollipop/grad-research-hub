# 研途 Hub 2026 调研驱动优化路线图

## 目标判断

研途 Hub 不做“大而全后台”，也不替代 Zotero、Obsidian、eLabFTW、OSF、Overleaf 或服务器文件系统。它要成为理工科研究生和博士生每天愿意打开的个人研究工作台：先告诉用户今天推进什么，再把文献、实验、结果、笔记、周报之间的断点接起来。

## 外部调研结论

- 文献管理：Zotero 已经成熟覆盖文献条目、集合、标签、搜索和同步。平台应该 Zotero-first，重点做“今天读哪几篇、读完沉淀到哪里”，不重复做 PDF 管理器。
- 实验记录：eLabFTW 这类 ELN 的高频价值在实验条目、模板、状态、步骤和结果记录。个人研究生最需要轻量实验日志、失败复盘和结果回填，而不是 LIMS、库存或仪器预约。
- 课题推进：OSF components 的价值是把大研究问题拆成阶段和材料。个人工作台应保留课题、里程碑、任务、推进笔记，不做完整协作仓库和权限系统。
- 笔记沉淀：Obsidian 的内链和反向链接说明，研究笔记的关键不是复杂编辑器，而是把阅读、实验、结果和写作素材自然关联起来。
- 数据与成果：研究数据管理和 FAIR 相关资料反复强调数据组织、文档化、可复现和可追溯。个人平台先回答“这条结果能否汇报、能否写进论文、缺什么证据”，不做重型数据平台。
- 日常事务：研究生高频压力来自组会、材料、报销、截止日散落在不同渠道。事务模块只做低负担收口，不做完整行政审批。

## 高需求工作流优先级

1. 今日指挥台：聚合任务、事务、实验、文献和结果，直接给出今天最该推进的 1-3 件事。
2. Zotero 阅读台：同步文献后形成待读/读中/已读队列，生成阅读计划和阅读笔记。
3. 实验日志台：用模板记录目的、方法、观察、结论、下一步，失败实验必须能快速复盘。
4. 课题推进台：保留课题路线、里程碑、任务和“为什么现在做它”的行动理由。
5. 结果证据台：围绕复现状态、图表路径、核心指标、写作素材判断结果是否可信。
6. 笔记沉淀台：保留大编辑区、Markdown、双链、反向链接、写作素材包，不做复杂知识图谱。
7. 组会/周报准备：一键把本周任务、实验、结果、文献、阻塞整理成可编辑 Markdown。
8. 设置连接中心：只暴露 AI Key、Base URL、Zotero Key、访问密码等常改项；数据库、端口、加密密钥留给部署配置。

## UI 方向

产品气质应是“研究工作室”，不是“后台管理系统”。全局界面采用低疲劳纸面网格、钴蓝主色、青绿行动色和少量暖砂提示色。第一屏必须优先呈现行动建议，不放营销式介绍，不堆统计卡，不放大量配置说明。

具体规则：

- 导航按研究闭环组织：文献 -> 实验 -> 成果 -> 写作。
- 顶部快速捕捉支持自然短句，降低记忆成本。
- 新增/编辑默认使用按钮和弹窗；笔记和实验正文保留大编辑空间。
- 卡片展示“下一步动作”和“行动理由”，不要只展示状态字段。
- 页面色彩降低饱和度，减少深色大块和强渐变，避免长时间使用疲劳。
- 所有配置相关信息收进设置中心，普通页面只呈现工作任务。

## 本轮落地

1. 修复入口中文乱码：应用壳、登录页、全局 metadata 必须是稳定中文。
2. 全局视觉从“后台浅色卡片”进一步转向“低疲劳研究工作室”：纸面网格、柔和层次、统一品牌标识和命令条。
3. 顶部快速捕捉文案改成自然短句示例，强调“随手写，系统分流”。
4. 登录页不再像普通后台登录框，突出自托管研究工作台和每日收口价值。
5. 不新增数据库表、不新增复杂配置、不引入新依赖。

## 后续验证清单

- `npm run lint`、`npm run build` 必须通过。
- 登录页和工作台首屏无乱码、无明显溢出、无过强视觉刺激。
- 未登录访问受保护页面仍跳转登录页。
- 服务器、GitHub、本地提交保持一致。

## 本轮追加落地：Zotero 阅读雷达

文献页已经具备 Zotero 同步、阅读状态、批量更新和阅读计划生成。新的优化重点不是增加字段，而是减少“同步了一堆文献但不知道先读哪篇”的选择成本。

本轮调整：

1. 左侧新增“阅读雷达”，把今天先读、读后补笔记、可沉淀素材三类信号放在一起。
2. 每张文献卡增加行动理由，解释为什么要开始阅读、继续阅读、补笔记或回顾素材。
3. 阅读雷达和卡片动作继续复用现有 `readStatus` 与 `notes`，不新增数据库表。
4. Zotero 继续作为文献源头，研途 Hub 只负责阅读推进和笔记沉淀。

验收标准：

- 用户打开文献页后，能直接看到当前阅读队列的下一步，而不是只看到文献列表。
- 已读但没有笔记的文献会被明确提示补沉淀。
- 有阅读笔记的文献会被引导进入组会、综述或论文草稿素材。
- `npm run lint` 和 `npm run build` 通过。

## 参考来源

- Zotero Web API v3: <https://www.zotero.org/support/dev/web_api/v3/basics>
- eLabFTW Experiments: <https://doc.elabftw.net/docs/usage/user-guide/experiments/>
- OSF Components: <https://help.osf.io/article/622-utilize-components-for-detailed-project-management>
- Obsidian Internal Links: <https://obsidian.md/help/links>
- Education Needs in Research Data Management for Science-Based Disciplines: <https://journals.library.ualberta.ca/istl/index.php/istl/article/view/12>
- Understanding Research Data Practices of Civil and Environmental Engineering Graduate Students: <https://journals.library.ualberta.ca/istl/index.php/istl/article/view/2678>
- Research data management needs assessment for graduate students: <https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0282152>
