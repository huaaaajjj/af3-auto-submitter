# AF3 Auto Submitter

本仓库是 [siyuanj/af3-auto-submitter](https://github.com/siyuanj/af3-auto-submitter) 的开发 fork，保留原作者 Jiang Siyuan 的署名和 [MIT 许可证](LICENSE)。脚本用于 AlphaFold Server 的 Saved Drafts 批量提交、Failed jobs 克隆重提，以及按日期筛选已完成任务后批量下载结果。

## 安装本 fork 的 DEV 版

[安装或更新 DEV 2.25.0-dev.5](https://raw.githubusercontent.com/huaaaajjj/af3-auto-submitter/dev/confirmed-submission/af3-auto-submitter.dev.user.js) · [开发分支](https://github.com/huaaaajjj/af3-auto-submitter/tree/dev/confirmed-submission) · [反馈问题](https://github.com/huaaaajjj/af3-auto-submitter/issues)

本轮按日期下载、提交确认、面板尺寸和实时额度功能均在 **`dev/confirmed-submission`**，尚未合并至 `main`。DEV 使用独立名称和 namespace；安装前请在 Tampermonkey 中禁用原版、旧 DEV 及其他 AlphaFold 自动提交脚本，只启用一份。

1. 安装并启用 Tampermonkey，点击上方 DEV 安装链接并确认安装。如果浏览器只显示源码，可新建油猴脚本、完整粘贴源码并保存。
2. 允许 Tampermonkey 在 `https://alphafoldserver.com/`（或 `https://www.alphafoldserver.com/`）运行。Edge InPrivate 还需允许扩展在 InPrivate 中使用。
3. 登录 AlphaFold Server 并刷新，确认面板显示 DEV `2.25.0-dev.5`。网站控件与通知仍需使用英文。
4. 进入 Saved Drafts 或 Failed jobs 列表。面板会显示当前页面中官网提供的 `Remaining jobs`；先核对额度，再设置本次数量。
5. 第一次只试 `1` 个。点击启动并核对模式和数量，保持页面打开，等待官网确认和运行汇总。
6. 若提交结果未确认或启动按钮锁定，先人工检查历史记录与官网额度；不要再手动点 Confirm，也不要刷新后直接重试。

DEV 的安装、检查更新和下载地址均为同一个本 fork 链接：

```text
https://raw.githubusercontent.com/huaaaajjj/af3-auto-submitter/dev/confirmed-submission/af3-auto-submitter.dev.user.js
```

在 Tampermonkey 的脚本设置中启用检查更新即可接收后续开发版；也可以手动“检查更新”。

## 本轮改动

### 按日期批量下载（DEV 2.25.0-dev.5）

1. 在官网 History 中**仅选中 `Completed`**，按需填写 `Search History`。面板会扫描当前搜索结果的所有分页，保留官网已有的复选框选中状态。
2. 展开面板的“按日期批量下载”，填写开始、结束日期，点击“查找任务”。日期按官网 **`Modified` 显示的日期**筛选，包含起止当天；两项填同一天即可选择一天。
3. 查找完成后，按天或逐个任务核对勾选，也可用“全选”“清空选择”。日期无法识别的任务不纳入结果；若出现同名且显示的 Modified 时间也相同、无法唯一识别的任务，请缩小官网搜索范围后重新查找。
4. 选择打包方式和操作位置。默认在面板内发起；也可切换到网页手动勾选，按下表操作。

| 操作位置与打包方式 | 如何下载 |
| --- | --- |
| 面板内：每个任务独立 ZIP | 点击面板“下载所选”并确认，逐个执行任务行的官网 `Download`，保留官网已有勾选。 |
| 面板内：合并成一个 ZIP | 点击面板“下载所选”并确认，替换官网已有勾选，跨页勾选本次核对过的任务，再执行一次官网批量下载。 |
| 网页手动：任选打包方式 | 点击面板“在网页中勾选”，将日期结果中已核对的选择写入官网复选框，**此步不下载**。可在官网继续调整勾选，最后点击脚本添加的网页工具条“下载所选”，按当前打包方式下载。也可以直接勾选官网任务并使用该工具条，无需先按日期查找。 |

**合并下载和“在网页中勾选”会先清空官网原有选择，再写入本次选择。** 合并为一个 ZIP 使用官网批量下载，每次最多 **50 个任务**；超过时会停止，不会自动拆成多批。请减少选择后再操作。

下载区域和网页工具条均显示“待机 / 就绪 / 运行中”状态；仅选中 Completed 时，顶部状态也会提示可下载。点击“停止”会阻止后续操作，已发起的下载仍由浏览器处理。**“已发起下载”不表示文件已保存成功**，请在浏览器下载列表核对；逐任务下载时，浏览器询问后请允许此站点下载多个文件。

查找、应用选择和下载期间保持页面打开，不要更改官网搜索、筛选、排序或每页数量；需要调整时先停止，再重新查找。网页手动模式下，可在应用选择完成后调整官网复选框。

### 提交结果确认

- 草稿和 Failed 克隆重提都只点击一次 `Confirm and submit`，收到官网新的 `Job successfully launched.` 消息后才计为成功。
- 弹窗消失、行内容变化、旧成功通知均不等于本次提交成功；未知通知会继续等待，60 秒内没有明确结果就停止。
- 官网错误、提交结果超时或提交中按停止，会锁住启动按钮，防止不确定状态下重复提交。刷新会清空当前页锁定记录，因此应先核对官网记录再决定后续操作。
- 草稿收到成功消息后，还需等待该任务从列表移出；列表未更新会保留成功计数并停止，不会重复提交同一行。
- 暂停只影响后续操作，不会挂起已经发送请求的结果确认。额度不足会停止，请以官网实际提示为准。

### 面板尺寸与位置

按住标题栏可移动面板；拖动右下角尺寸手柄可调整大小。手柄也可用键盘操作：按 Tab 聚焦后，使用方向键调节尺寸。位置与尺寸保存在当前浏览器本地，刷新后会恢复。窄屏、窗口变小或网页缩放时，面板会约束在视口内。

本地存储被浏览器禁用时，当前页面仍可调整尺寸；刷新后恢复尺寸需要本地存储可用。面板标题显示当前 DEV 版本号，便于核对更新。

### 当前账号的官网额度

面板实时读取当前页面的 `Remaining jobs`，打开任务预览时优先显示预览中的额度。账号切换或页面 DOM 更新后会重新读取；读取不到或存在歧义时显示“无法识别”，不会把未知额度当作 `0`。这是官网页面所显示的额度，脚本不会自行推算或增加额度。

额度显示仅读取页面内容，不额外请求官网接口、不读取 Cookie，也不上传账号或任务数据。

### 保留的面板功能

保留中文及其他五种界面语言、运行前摘要、暂停/继续/停止、完成汇总和可折叠日志。DEV 中的锁定只覆盖当前页面，不提供跨标签页或跨浏览器互斥。

## `main` 分支与旧行为基线

`main` 的 `2.24.1` 仅整理了本 fork 的发布元数据；它仍是旧行为基线，**不包含 DEV 的按日期下载、提交确认、尺寸调整和实时额度功能**。需要这些改动请使用上面的 DEV 安装链接。

- [旧行为基线源码 2.24.1（需手动安装）](https://raw.githubusercontent.com/huaaaajjj/af3-auto-submitter/main/af3-auto-submitter.js)
- [旧行为基线的更新元数据](https://raw.githubusercontent.com/huaaaajjj/af3-auto-submitter/main/af3-auto-submitter.meta.js)

基线文件扩展名为 `.js`，可能只在浏览器显示源码；如果确需对照安装，可手动复制到 Tampermonkey。不要与 DEV 同时启用，也不要把基线的版本号理解为已包含开发分支修复。

## 验证与排查

本地验证使用完整 DEV 脚本和隔离浏览器内的合成页面，不访问 AlphaFold、不使用登录资料、不消耗预测额度：

```bash
node --check af3-auto-submitter.dev.user.js
python -I -X utf8 test_submission.py
python -I -X utf8 test_download.py
git diff --check
```

完整浏览器检查包含两项真实的 60 秒等待，通常需要数分钟。模拟测试不等于真实账号端到端验证；首次仍应只试一个任务。

面板不显示时，先确认只启用一份 DEV、版本正确、扩展具备站点权限，然后刷新官网。额度显示“无法识别”时，请直接核对官网页面和登录状态；不要把它理解为额度耗尽。提交卡住时查看官网提示与面板日志，若结果不确定，先人工核对历史记录再决定下一步。

## 文件与开发流程

- `af3-auto-submitter.dev.user.js`：本 fork 的 DEV 安装入口，开发分支为 `dev/confirmed-submission`。
- `test_submission.py`：完整 DEV 的本地提交与面板检查。
- `test_download.py`：按日期扫描、勾选及下载流程的本地合成页面检查。
- `af3-auto-submitter.js`、`af3-auto-submitter.meta.js`：`main` 的旧行为基线与发布元数据。
- `index.html`：本 fork 的中文安装说明。
- `init.png`、`saved_draft.png`、`failed.png`：上游界面参考截图，不代表当前 DEV 的版本或新增功能。

新功能在开发分支完成检查并单独评审；本轮不会把 DEV 合入 `main`。上游仓库链接仅用于来源说明，本 fork 的安装及更新均从 `huaaaajjj/af3-auto-submitter` 获取。
