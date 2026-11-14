// ==UserScript==
// @name         AF3 Auto Submitter DEV (huaaaajjj)
// @namespace    https://github.com/huaaaajjj/af3-auto-submitter/dev
// @version      2.25.0-dev.9
// @description  开发版：按天筛选，合并或逐个勾选后手动使用官网 Download 下载；放大面板文字，保留提交确认、实时额度和可调面板。
// @author       Jiang Siyuan; huaaaajjj
// @homepageURL  https://github.com/huaaaajjj/af3-auto-submitter
// @supportURL   https://github.com/huaaaajjj/af3-auto-submitter/issues
// @match        https://alphafoldserver.com/*
// @match        https://www.alphafoldserver.com/*
// @grant        none
// @run-at       document-start
// @noframes
// @updateURL    https://raw.githubusercontent.com/huaaaajjj/af3-auto-submitter/dev/confirmed-submission/af3-auto-submitter.dev.user.js
// @downloadURL  https://raw.githubusercontent.com/huaaaajjj/af3-auto-submitter/dev/confirmed-submission/af3-auto-submitter.dev.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置 ---
    const SCRIPT_VERSION = '2.25.0-dev.9';
    const CONTAINER_ID = 'af3-dev-panel';
    const PANEL_ROOT_ID = 'af3-dev-panel-root';
    const PANEL_POSITION_KEY = `${CONTAINER_ID}-position`;
    const PANEL_SIZE_KEY = `${CONTAINER_ID}-size`;
    const LANGUAGE_KEY = `${CONTAINER_ID}-language`;
    const DOWNLOAD_FORMAT_KEY = `${CONTAINER_ID}-download-format`;
    const WAIT_FOR_MODAL = 2000;
    const WAIT_FOR_PAGE_LOAD = 3000; // 跳转等待时间
    const SUBMISSION_TIMEOUT = 60000;
    // -----------

    const LANGUAGES = [
        ['zh', '中文'],
        ['en', 'English'],
        ['ja', '日本語'],
        ['ko', '한국어'],
        ['es', 'Español'],
        ['fr', 'Français']
    ];

    const I18N = {
        zh: {
            quotaRemaining: '官网剩余额度：{count} 个',
            quotaUnknown: '官网剩余额度：无法识别，请检查登录与官网显示。',
            quotaPreview: '（预览）',
            resizePanel: '拖动调整面板大小；聚焦后用方向键调整',
            verifyingSubmission: "等待官网确认…",
            submissionLocked: "需要人工核对",
            submissionNotReady: "提交按钮已失效或不可用，未提交。",
            submissionUncertain: "提交结果尚未确认，已停止且锁定启动。请先人工核对历史记录与额度，再刷新页面；不要直接重试。",
            submissionServerError: "官网报告提交错误：{message}。已停止且锁定启动，请核对历史记录与额度后刷新。",
            draftListUnchanged: "官网已报告成功，但草稿列表未更新。已停止且锁定启动，未再次提交；请核对历史记录后刷新。",
            headerDev: '🧪 AF3 自动助手 DEV',
            headerProd: '🤖 AF3 自动助手',
            languageTitle: '界面语言',
            initializing: '初始化...',
            startButton: '🚀 启动',
            runningButton: '运行中...',
            pausedButton: '已暂停',
            stoppingButton: '停止中...',
            pauseButton: '暂停',
            resumeButton: '继续',
            stopButton: '停止',
            logLabel: '日志',
            devFooter: '⚠️ DEV测试版：请禁用正式版后测试',
            modeDraftFooter: '模式: 批量提交 Saved Drafts',
            modeFailedFooter: '模式: Clone & Resubmit',
            standbyFooter: '请在下方列表中仅保留 Saved draft/Failed 列表',
            readyDraftStatus: '🟢 就绪: 提交草稿',
            readyFailedStatus: '🔵 就绪: 失败任务重跑',
            standbyStatus: '😴 待机中: 请切换页面',
            modeDraft: '批量提交 Saved Drafts',
            modeFailed: '失败任务 Clone & Resubmit',
            modeUnknown: '未识别',
            batchStopped: '批处理已停止',
            batchError: '批处理异常结束',
            batchDone: '批处理结束',
            reason: '原因：{detail}',
            summaryDone: '完成：{count} 个',
            summarySkipped: '跳过：{count} 个',
            summaryFailed: '失败：{count} 个',
            skippedTasksTitle: '跳过的任务：',
            failedTasksTitle: '失败的任务：',
            taskSummaryLine: '- {label}：{reason}',
            moreTasks: '还有 {count} 个未显示，请展开日志查看。',
            viewLogsHint: '如需查看原因，请展开面板日志。',
            runSummaryLog: '运行汇总：完成 {success}，跳过 {skipped}，错误 {errors}',
            stopRequested: '收到停止请求，当前步骤结束后停止',
            pausedLog: '已暂停，点击继续恢复',
            resumedLog: '继续运行',
            userStoppedError: '用户已停止',
            noRowsAlert: '当前页面没有识别到可处理的任务行。',
            noRowsLog: '启动取消：未识别到可处理任务行',
            confirmTitle: '运行前确认',
            confirmMode: '当前模式：{mode}',
            confirmRows: '识别到任务行：{count}',
            confirmPlan: '计划处理数量：{count}',
            confirmPrompt: '请确认当前列表和数量无误。',
            userCancelled: '用户取消启动',
            startConfirmed: '启动确认：{mode}，计划处理 {planned} 个，当前识别 {rows} 行',
            clickRowMenu: '点击行菜单按钮',
            lookingClone: '寻找 Clone and reuse 选项',
            foundClone: '找到 Clone and reuse，准备点击',
            backFailedTab: '尝试切回 Failed 列表',
            draftProgress: '草稿提交：处理第 {current} / {total} 个，当前识别 {rows} 行',
            listEmptyDetail: '列表已空，已停止处理。',
            listEmptyLog: '列表已空，停止处理',
            foundContinue: '找到 Continue and preview job，准备点击',
            missingContinue: '未找到 Continue 按钮，跳过当前行',
            quotaFull: '配额已满',
            missingConfirm: 'Confirm 未出现，跳过当前行',
            foundConfirm: '找到 Confirm and submit，准备提交',
            draftDone: '第 {index} 个草稿提交完成',
            draftUnconfirmed: '第 {index} 个草稿提交后未确认列表更新',
            draftStopped: '草稿提交停止：{message}',
            failedProgress: '失败重跑：处理第 {current} / {total} 个',
            failedAllDoneDetail: '已处理完当前页所有 Failed 任务。',
            failedAllDoneLog: '已处理完当前页所有 Failed 任务',
            missingMenu: '第 {index} 行找不到菜单按钮，跳过',
            missingClone: '第 {index} 行未找到 Clone 选项，跳过',
            missingCloneContinue: 'Clone 后未找到 Continue 按钮，跳过当前任务',
            missingConfirmError: '提交确认框未弹出',
            failedSubmitted: '第 {index} 个失败任务已提交',
            failedStopped: '失败重跑停止：{message}',
            runStarted: '运行开始',
            runEnded: '运行结束'
        },
        en: {
            quotaRemaining: 'Server jobs remaining: {count}',
            quotaUnknown: 'Server quota unavailable. Check sign-in and the site display.',
            quotaPreview: ' (preview)',
            resizePanel: 'Drag to resize the panel; use arrow keys when focused',
            verifyingSubmission: "Waiting for server confirmation…",
            submissionLocked: "Manual review required",
            submissionNotReady: "The submit button is no longer available. Nothing was submitted.",
            submissionUncertain: "Submission is unconfirmed. The batch stopped and Start is locked. Check history and quota manually before reloading; do not retry blindly.",
            submissionServerError: "Server reported a submission error: {message}. The batch stopped and Start is locked. Check history and quota before reloading.",
            draftListUnchanged: "The server reported success, but the draft list did not update. The batch stopped and Start is locked. No repeat submission was sent; check history before reloading.",
            headerDev: '🧪 AF3 Auto Submitter DEV',
            headerProd: '🤖 AF3 Auto Submitter',
            languageTitle: 'Language',
            initializing: 'Initializing...',
            startButton: '🚀 Start',
            runningButton: 'Running...',
            pausedButton: 'Paused',
            stoppingButton: 'Stopping...',
            pauseButton: 'Pause',
            resumeButton: 'Resume',
            stopButton: 'Stop',
            logLabel: 'Log',
            devFooter: '⚠️ DEV build: disable the stable script while testing',
            modeDraftFooter: 'Mode: Submit Saved Drafts',
            modeFailedFooter: 'Mode: Clone & Resubmit',
            standbyFooter: 'Open a Saved draft or Failed list below',
            readyDraftStatus: '🟢 Ready: submit drafts',
            readyFailedStatus: '🔵 Ready: rerun failed jobs',
            standbyStatus: '😴 Idle: switch page',
            modeDraft: 'Submit Saved Drafts',
            modeFailed: 'Clone & Resubmit failed jobs',
            modeUnknown: 'Not recognized',
            batchStopped: 'Batch stopped',
            batchError: 'Batch ended with an error',
            batchDone: 'Batch finished',
            reason: 'Reason: {detail}',
            summaryDone: 'Completed: {count}',
            summarySkipped: 'Skipped: {count}',
            summaryFailed: 'Failed: {count}',
            skippedTasksTitle: 'Skipped tasks:',
            failedTasksTitle: 'Failed tasks:',
            taskSummaryLine: '- {label}: {reason}',
            moreTasks: '{count} more not shown. Expand the log for details.',
            viewLogsHint: 'Expand the panel log for details.',
            runSummaryLog: 'Run summary: completed {success}, skipped {skipped}, errors {errors}',
            stopRequested: 'Stop requested; stopping after the current step',
            pausedLog: 'Paused; click Resume to continue',
            resumedLog: 'Resumed',
            userStoppedError: 'User stopped the run',
            noRowsAlert: 'No processable task rows were detected on this page.',
            noRowsLog: 'Start cancelled: no processable task rows detected',
            confirmTitle: 'Pre-run confirmation',
            confirmMode: 'Mode: {mode}',
            confirmRows: 'Detected rows: {count}',
            confirmPlan: 'Planned jobs: {count}',
            confirmPrompt: 'Confirm that the current list and count are correct.',
            userCancelled: 'User cancelled start',
            startConfirmed: 'Start confirmed: {mode}, planned {planned}, detected {rows} rows',
            clickRowMenu: 'Clicked row menu button',
            lookingClone: 'Looking for Clone and reuse',
            foundClone: 'Found Clone and reuse; clicking',
            backFailedTab: 'Trying to switch back to the Failed list',
            draftProgress: 'Draft submit: processing {current} / {total}, detected {rows} rows',
            listEmptyDetail: 'The list is empty; processing stopped.',
            listEmptyLog: 'List is empty; stopping',
            foundContinue: 'Found Continue and preview job; clicking',
            missingContinue: 'Continue button not found; skipping this row',
            quotaFull: 'Daily quota reached',
            missingConfirm: 'Confirm button did not appear; skipping this row',
            foundConfirm: 'Found Confirm and submit; submitting',
            draftDone: 'Draft {index} submitted',
            draftUnconfirmed: 'Draft {index} submitted but list update was not confirmed',
            draftStopped: 'Draft submission stopped: {message}',
            failedProgress: 'Failed rerun: processing {current} / {total}',
            failedAllDoneDetail: 'All Failed jobs on the current page have been processed.',
            failedAllDoneLog: 'All Failed jobs on the current page have been processed',
            missingMenu: 'Row {index} has no menu button; skipping',
            missingClone: 'Row {index} has no Clone option; skipping',
            missingCloneContinue: 'Continue button not found after clone; skipping this job',
            missingConfirmError: 'Submit confirmation dialog did not appear',
            failedSubmitted: 'Failed job {index} submitted',
            failedStopped: 'Failed rerun stopped: {message}',
            runStarted: 'Run started',
            runEnded: 'Run ended'
        },
        ja: {
            quotaRemaining: 'サーバーの残りジョブ数：{count}',
            quotaUnknown: '残り枠を取得できません。ログインとサイト表示を確認してください。',
            quotaPreview: '（プレビュー）',
            resizePanel: 'ドラッグでサイズ変更。フォーカス中は矢印キーで調整',
            verifyingSubmission: "サーバーの確認を待機中…",
            submissionLocked: "手動確認が必要です",
            submissionNotReady: "送信ボタンが無効または表示されていません。送信していません。",
            submissionUncertain: "送信結果を確認できません。処理を停止し、開始をロックしました。履歴と残り枠を手動で確認してから再読み込みしてください。確認せず再試行しないでください。",
            submissionServerError: "サーバーの送信エラー：{message}。処理を停止し、開始をロックしました。履歴と残り枠を確認してから再読み込みしてください。",
            draftListUnchanged: "サーバーは成功を報告しましたが、下書き一覧が更新されませんでした。開始をロックし、再送信せず停止しました。履歴を確認してから再読み込みしてください。",
            headerDev: '🧪 AF3 自動送信 DEV',
            headerProd: '🤖 AF3 自動送信',
            languageTitle: '言語',
            initializing: '初期化中...',
            startButton: '🚀 開始',
            runningButton: '実行中...',
            pausedButton: '一時停止中',
            stoppingButton: '停止中...',
            pauseButton: '一時停止',
            resumeButton: '再開',
            stopButton: '停止',
            logLabel: 'ログ',
            devFooter: '⚠️ DEV版: テスト時は正式版を無効にしてください',
            modeDraftFooter: 'モード: Saved Drafts 一括送信',
            modeFailedFooter: 'モード: Clone & Resubmit',
            standbyFooter: '下のリストを Saved draft / Failed にしてください',
            readyDraftStatus: '🟢 準備完了: 下書きを送信',
            readyFailedStatus: '🔵 準備完了: 失敗ジョブを再実行',
            standbyStatus: '😴 待機中: ページを切り替えてください',
            modeDraft: 'Saved Drafts 一括送信',
            modeFailed: '失敗ジョブの Clone & Resubmit',
            modeUnknown: '未認識',
            batchStopped: 'バッチを停止しました',
            batchError: 'バッチがエラーで終了しました',
            batchDone: 'バッチ完了',
            reason: '理由：{detail}',
            summaryDone: '完了：{count}',
            summarySkipped: 'スキップ：{count}',
            summaryFailed: '失敗：{count}',
            skippedTasksTitle: 'スキップしたタスク：',
            failedTasksTitle: '失敗したタスク：',
            taskSummaryLine: '- {label}：{reason}',
            moreTasks: 'ほか {count} 件は未表示です。ログを展開してください。',
            viewLogsHint: '理由を確認するにはパネルのログを展開してください。',
            runSummaryLog: '実行サマリー：完了 {success}、スキップ {skipped}、エラー {errors}',
            stopRequested: '停止要求を受け取りました。現在の手順後に停止します',
            pausedLog: '一時停止しました。再開で続行します',
            resumedLog: '再開しました',
            userStoppedError: 'ユーザーが停止しました',
            noRowsAlert: '処理可能なタスク行が見つかりません。',
            noRowsLog: '開始をキャンセル：処理可能な行がありません',
            confirmTitle: '実行前確認',
            confirmMode: 'モード：{mode}',
            confirmRows: '検出行数：{count}',
            confirmPlan: '処理予定数：{count}',
            confirmPrompt: '現在のリストと件数が正しいことを確認してください。',
            userCancelled: 'ユーザーが開始をキャンセルしました',
            startConfirmed: '開始確認：{mode}、予定 {planned}、検出 {rows} 行',
            clickRowMenu: '行メニューをクリック',
            lookingClone: 'Clone and reuse を検索中',
            foundClone: 'Clone and reuse を検出、クリックします',
            backFailedTab: 'Failed リストへ戻ります',
            draftProgress: '下書き送信：{current} / {total}、検出 {rows} 行',
            listEmptyDetail: 'リストが空のため停止しました。',
            listEmptyLog: 'リストが空です。停止します',
            foundContinue: 'Continue and preview job を検出、クリックします',
            missingContinue: 'Continue ボタンが見つからないためスキップ',
            quotaFull: '日次クォータに達しました',
            missingConfirm: 'Confirm が表示されないためスキップ',
            foundConfirm: 'Confirm and submit を検出、送信します',
            draftDone: '下書き {index} を送信しました',
            draftUnconfirmed: '下書き {index} の送信後、リスト更新を確認できません',
            draftStopped: '下書き送信を停止：{message}',
            failedProgress: '失敗再実行：{current} / {total}',
            failedAllDoneDetail: '現在のページの Failed ジョブはすべて処理済みです。',
            failedAllDoneLog: '現在のページの Failed ジョブはすべて処理済みです',
            missingMenu: '{index} 行目にメニューボタンがないためスキップ',
            missingClone: '{index} 行目に Clone がないためスキップ',
            missingCloneContinue: 'Clone 後に Continue が見つからないためスキップ',
            missingConfirmError: '送信確認ダイアログが表示されません',
            failedSubmitted: '失敗ジョブ {index} を送信しました',
            failedStopped: '失敗再実行を停止：{message}',
            runStarted: '実行開始',
            runEnded: '実行終了'
        },
        ko: {
            quotaRemaining: '서버 남은 작업 수: {count}',
            quotaUnknown: '할당량을 읽을 수 없습니다. 로그인과 사이트 표시를 확인하세요.',
            quotaPreview: ' (미리보기)',
            resizePanel: '드래그하여 크기 조절. 포커스 시 방향키로 조절',
            verifyingSubmission: "서버 확인 대기 중…",
            submissionLocked: "수동 확인 필요",
            submissionNotReady: "제출 버튼을 사용할 수 없습니다. 제출하지 않았습니다.",
            submissionUncertain: "제출 결과를 확인하지 못했습니다. 중지하고 시작 버튼을 잠갔습니다. 기록과 잔여 할당량을 직접 확인한 뒤 새로고침하세요. 무작정 재시도하지 마세요.",
            submissionServerError: "서버 제출 오류: {message}. 중지하고 시작 버튼을 잠갔습니다. 기록과 할당량을 확인한 뒤 새로고침하세요.",
            draftListUnchanged: "서버는 성공을 보고했지만 초안 목록이 갱신되지 않았습니다. 재제출하지 않고 중지하고 시작 버튼을 잠갔습니다. 기록 확인 후 새로고침하세요.",
            headerDev: '🧪 AF3 자동 제출 DEV',
            headerProd: '🤖 AF3 자동 제출',
            languageTitle: '언어',
            initializing: '초기화 중...',
            startButton: '🚀 시작',
            runningButton: '실행 중...',
            pausedButton: '일시정지됨',
            stoppingButton: '중지 중...',
            pauseButton: '일시정지',
            resumeButton: '계속',
            stopButton: '중지',
            logLabel: '로그',
            devFooter: '⚠️ DEV 버전: 테스트 중에는 정식 버전을 비활성화하세요',
            modeDraftFooter: '모드: Saved Drafts 일괄 제출',
            modeFailedFooter: '모드: Clone & Resubmit',
            standbyFooter: '아래 목록을 Saved draft 또는 Failed 로 유지하세요',
            readyDraftStatus: '🟢 준비됨: 초안 제출',
            readyFailedStatus: '🔵 준비됨: 실패 작업 재실행',
            standbyStatus: '😴 대기 중: 페이지를 전환하세요',
            modeDraft: 'Saved Drafts 일괄 제출',
            modeFailed: '실패 작업 Clone & Resubmit',
            modeUnknown: '인식되지 않음',
            batchStopped: '배치가 중지됨',
            batchError: '배치가 오류로 종료됨',
            batchDone: '배치 완료',
            reason: '이유: {detail}',
            summaryDone: '완료: {count}',
            summarySkipped: '건너뜀: {count}',
            summaryFailed: '실패: {count}',
            skippedTasksTitle: '건너뛴 작업:',
            failedTasksTitle: '실패한 작업:',
            taskSummaryLine: '- {label}: {reason}',
            moreTasks: '{count}개 더 있습니다. 자세한 내용은 로그를 펼쳐 확인하세요.',
            viewLogsHint: '자세한 내용은 패널 로그를 펼쳐 확인하세요.',
            runSummaryLog: '실행 요약: 완료 {success}, 건너뜀 {skipped}, 오류 {errors}',
            stopRequested: '중지 요청을 받았습니다. 현재 단계 후 중지합니다',
            pausedLog: '일시정지됨. 계속을 눌러 재개하세요',
            resumedLog: '재개됨',
            userStoppedError: '사용자가 중지했습니다',
            noRowsAlert: '처리할 수 있는 작업 행을 찾지 못했습니다.',
            noRowsLog: '시작 취소: 처리 가능한 작업 행 없음',
            confirmTitle: '실행 전 확인',
            confirmMode: '모드: {mode}',
            confirmRows: '감지된 행: {count}',
            confirmPlan: '처리 예정: {count}',
            confirmPrompt: '현재 목록과 개수가 올바른지 확인하세요.',
            userCancelled: '사용자가 시작을 취소했습니다',
            startConfirmed: '시작 확인: {mode}, 예정 {planned}, 감지 {rows}행',
            clickRowMenu: '행 메뉴 버튼 클릭',
            lookingClone: 'Clone and reuse 찾는 중',
            foundClone: 'Clone and reuse 발견, 클릭합니다',
            backFailedTab: 'Failed 목록으로 돌아가는 중',
            draftProgress: '초안 제출: {current} / {total}, 감지 {rows}행',
            listEmptyDetail: '목록이 비어 있어 처리를 중지했습니다.',
            listEmptyLog: '목록이 비어 있음, 중지',
            foundContinue: 'Continue and preview job 발견, 클릭합니다',
            missingContinue: 'Continue 버튼 없음, 현재 행 건너뜀',
            quotaFull: '일일 할당량에 도달했습니다',
            missingConfirm: 'Confirm 이 나타나지 않아 건너뜀',
            foundConfirm: 'Confirm and submit 발견, 제출합니다',
            draftDone: '초안 {index} 제출 완료',
            draftUnconfirmed: '초안 {index} 제출 후 목록 업데이트를 확인하지 못함',
            draftStopped: '초안 제출 중지: {message}',
            failedProgress: '실패 재실행: {current} / {total}',
            failedAllDoneDetail: '현재 페이지의 Failed 작업을 모두 처리했습니다.',
            failedAllDoneLog: '현재 페이지의 Failed 작업을 모두 처리했습니다',
            missingMenu: '{index}행에 메뉴 버튼 없음, 건너뜀',
            missingClone: '{index}행에 Clone 옵션 없음, 건너뜀',
            missingCloneContinue: 'Clone 후 Continue 버튼 없음, 건너뜀',
            missingConfirmError: '제출 확인 창이 나타나지 않았습니다',
            failedSubmitted: '실패 작업 {index} 제출 완료',
            failedStopped: '실패 재실행 중지: {message}',
            runStarted: '실행 시작',
            runEnded: '실행 종료'
        },
        es: {
            quotaRemaining: 'Tareas restantes del servidor: {count}',
            quotaUnknown: 'Cuota no disponible. Revisa la sesión y la página.',
            quotaPreview: ' (vista previa)',
            resizePanel: 'Arrastra para cambiar el tamaño; usa las flechas al enfocar',
            verifyingSubmission: "Esperando confirmación del servidor…",
            submissionLocked: "Revisión manual necesaria",
            submissionNotReady: "El botón de envío ya no está disponible. No se envió nada.",
            submissionUncertain: "No se confirmó el envío. El lote se detuvo e Iniciar quedó bloqueado. Revisa el historial y la cuota antes de recargar; no reintentes sin comprobarlos.",
            submissionServerError: "Error de envío del servidor: {message}. El lote se detuvo e Iniciar quedó bloqueado. Revisa el historial y la cuota antes de recargar.",
            draftListUnchanged: "El servidor informó de éxito, pero la lista de borradores no se actualizó. Se detuvo el lote y se bloqueó Iniciar sin repetir el envío. Revisa el historial antes de recargar.",
            headerDev: '🧪 AF3 Auto Submitter DEV',
            headerProd: '🤖 AF3 Auto Submitter',
            languageTitle: 'Idioma',
            initializing: 'Inicializando...',
            startButton: '🚀 Iniciar',
            runningButton: 'Ejecutando...',
            pausedButton: 'Pausado',
            stoppingButton: 'Deteniendo...',
            pauseButton: 'Pausa',
            resumeButton: 'Continuar',
            stopButton: 'Detener',
            logLabel: 'Registro',
            devFooter: '⚠️ Versión DEV: desactiva la versión estable al probar',
            modeDraftFooter: 'Modo: enviar Saved Drafts',
            modeFailedFooter: 'Modo: Clone & Resubmit',
            standbyFooter: 'Abre una lista Saved draft o Failed abajo',
            readyDraftStatus: '🟢 Listo: enviar borradores',
            readyFailedStatus: '🔵 Listo: reenviar fallidos',
            standbyStatus: '😴 En espera: cambia de página',
            modeDraft: 'Enviar Saved Drafts',
            modeFailed: 'Clone & Resubmit de fallidos',
            modeUnknown: 'No reconocido',
            batchStopped: 'Lote detenido',
            batchError: 'El lote terminó con error',
            batchDone: 'Lote finalizado',
            reason: 'Motivo: {detail}',
            summaryDone: 'Completados: {count}',
            summarySkipped: 'Omitidos: {count}',
            summaryFailed: 'Fallidos: {count}',
            skippedTasksTitle: 'Tareas omitidas:',
            failedTasksTitle: 'Tareas fallidas:',
            taskSummaryLine: '- {label}: {reason}',
            moreTasks: '{count} más sin mostrar. Expande el registro para ver detalles.',
            viewLogsHint: 'Expande el registro del panel para ver detalles.',
            runSummaryLog: 'Resumen: completados {success}, omitidos {skipped}, errores {errors}',
            stopRequested: 'Detención solicitada; se detendrá tras el paso actual',
            pausedLog: 'Pausado; pulsa Continuar para seguir',
            resumedLog: 'Continuado',
            userStoppedError: 'El usuario detuvo la ejecución',
            noRowsAlert: 'No se detectaron filas de tareas procesables.',
            noRowsLog: 'Inicio cancelado: no hay filas procesables',
            confirmTitle: 'Confirmación antes de ejecutar',
            confirmMode: 'Modo: {mode}',
            confirmRows: 'Filas detectadas: {count}',
            confirmPlan: 'Tareas previstas: {count}',
            confirmPrompt: 'Confirma que la lista y el número son correctos.',
            userCancelled: 'El usuario canceló el inicio',
            startConfirmed: 'Inicio confirmado: {mode}, previstas {planned}, detectadas {rows} filas',
            clickRowMenu: 'Clic en el menú de la fila',
            lookingClone: 'Buscando Clone and reuse',
            foundClone: 'Clone and reuse encontrado; haciendo clic',
            backFailedTab: 'Intentando volver a la lista Failed',
            draftProgress: 'Enviando borrador: {current} / {total}, detectadas {rows} filas',
            listEmptyDetail: 'La lista está vacía; se detuvo el proceso.',
            listEmptyLog: 'Lista vacía; deteniendo',
            foundContinue: 'Continue and preview job encontrado; haciendo clic',
            missingContinue: 'No se encontró Continue; se omite la fila',
            quotaFull: 'Se alcanzó la cuota diaria',
            missingConfirm: 'No apareció Confirm; se omite la fila',
            foundConfirm: 'Confirm and submit encontrado; enviando',
            draftDone: 'Borrador {index} enviado',
            draftUnconfirmed: 'Borrador {index} enviado, pero no se confirmó el cambio en la lista',
            draftStopped: 'Envío de borradores detenido: {message}',
            failedProgress: 'Reenvío de fallidos: {current} / {total}',
            failedAllDoneDetail: 'Todas las tareas Failed de la página actual fueron procesadas.',
            failedAllDoneLog: 'Todas las tareas Failed de la página actual fueron procesadas',
            missingMenu: 'La fila {index} no tiene botón de menú; se omite',
            missingClone: 'La fila {index} no tiene opción Clone; se omite',
            missingCloneContinue: 'No se encontró Continue tras clonar; se omite la tarea',
            missingConfirmError: 'No apareció el diálogo de confirmación',
            failedSubmitted: 'Tarea fallida {index} enviada',
            failedStopped: 'Reenvío de fallidos detenido: {message}',
            runStarted: 'Ejecución iniciada',
            runEnded: 'Ejecución finalizada'
        },
        fr: {
            quotaRemaining: 'Tâches restantes du serveur : {count}',
            quotaUnknown: 'Quota indisponible. Vérifiez la connexion et la page.',
            quotaPreview: ' (aperçu)',
            resizePanel: 'Glissez pour redimensionner ; flèches quand la poignée est sélectionnée',
            verifyingSubmission: "En attente de confirmation du serveur…",
            submissionLocked: "Vérification manuelle requise",
            submissionNotReady: "Le bouton d’envoi n’est plus disponible. Aucun envoi effectué.",
            submissionUncertain: "L’envoi n’est pas confirmé. Le lot est arrêté et Démarrer est verrouillé. Vérifiez l’historique et le quota avant de recharger ; ne réessayez pas sans vérifier.",
            submissionServerError: "Erreur d’envoi du serveur : {message}. Le lot est arrêté et Démarrer est verrouillé. Vérifiez l’historique et le quota avant de recharger.",
            draftListUnchanged: "Le serveur a signalé un succès, mais la liste des brouillons n’a pas changé. Le lot est arrêté et Démarrer est verrouillé, sans nouvel envoi. Vérifiez l’historique avant de recharger.",
            headerDev: '🧪 AF3 Auto Submitter DEV',
            headerProd: '🤖 AF3 Auto Submitter',
            languageTitle: 'Langue',
            initializing: 'Initialisation...',
            startButton: '🚀 Démarrer',
            runningButton: 'En cours...',
            pausedButton: 'En pause',
            stoppingButton: 'Arrêt...',
            pauseButton: 'Pause',
            resumeButton: 'Reprendre',
            stopButton: 'Arrêter',
            logLabel: 'Journal',
            devFooter: '⚠️ Version DEV : désactivez la version stable pendant les tests',
            modeDraftFooter: 'Mode : envoyer les Saved Drafts',
            modeFailedFooter: 'Mode : Clone & Resubmit',
            standbyFooter: 'Ouvrez une liste Saved draft ou Failed ci-dessous',
            readyDraftStatus: '🟢 Prêt : envoyer les brouillons',
            readyFailedStatus: '🔵 Prêt : relancer les échecs',
            standbyStatus: '😴 En attente : changez de page',
            modeDraft: 'Envoyer les Saved Drafts',
            modeFailed: 'Clone & Resubmit des échecs',
            modeUnknown: 'Non reconnu',
            batchStopped: 'Lot arrêté',
            batchError: 'Le lot s’est terminé avec une erreur',
            batchDone: 'Lot terminé',
            reason: 'Raison : {detail}',
            summaryDone: 'Terminés : {count}',
            summarySkipped: 'Ignorés : {count}',
            summaryFailed: 'Échecs : {count}',
            skippedTasksTitle: 'Tâches ignorées :',
            failedTasksTitle: 'Tâches en échec :',
            taskSummaryLine: '- {label} : {reason}',
            moreTasks: '{count} autres non affichées. Dépliez le journal pour les détails.',
            viewLogsHint: 'Dépliez le journal du panneau pour voir les détails.',
            runSummaryLog: 'Résumé : terminés {success}, ignorés {skipped}, erreurs {errors}',
            stopRequested: 'Arrêt demandé ; arrêt après l’étape en cours',
            pausedLog: 'En pause ; cliquez sur Reprendre pour continuer',
            resumedLog: 'Repris',
            userStoppedError: 'L’utilisateur a arrêté l’exécution',
            noRowsAlert: 'Aucune ligne de tâche traitable détectée.',
            noRowsLog: 'Démarrage annulé : aucune ligne traitable',
            confirmTitle: 'Confirmation avant exécution',
            confirmMode: 'Mode : {mode}',
            confirmRows: 'Lignes détectées : {count}',
            confirmPlan: 'Tâches prévues : {count}',
            confirmPrompt: 'Confirmez que la liste et le nombre sont corrects.',
            userCancelled: 'L’utilisateur a annulé le démarrage',
            startConfirmed: 'Démarrage confirmé : {mode}, prévues {planned}, {rows} lignes détectées',
            clickRowMenu: 'Clic sur le menu de la ligne',
            lookingClone: 'Recherche de Clone and reuse',
            foundClone: 'Clone and reuse trouvé ; clic',
            backFailedTab: 'Tentative de retour à la liste Failed',
            draftProgress: 'Envoi brouillon : {current} / {total}, {rows} lignes détectées',
            listEmptyDetail: 'La liste est vide ; traitement arrêté.',
            listEmptyLog: 'Liste vide ; arrêt',
            foundContinue: 'Continue and preview job trouvé ; clic',
            missingContinue: 'Bouton Continue introuvable ; ligne ignorée',
            quotaFull: 'Quota quotidien atteint',
            missingConfirm: 'Confirm n’est pas apparu ; ligne ignorée',
            foundConfirm: 'Confirm and submit trouvé ; envoi',
            draftDone: 'Brouillon {index} envoyé',
            draftUnconfirmed: 'Brouillon {index} envoyé, mais la mise à jour de la liste n’a pas été confirmée',
            draftStopped: 'Envoi des brouillons arrêté : {message}',
            failedProgress: 'Relance des échecs : {current} / {total}',
            failedAllDoneDetail: 'Toutes les tâches Failed de la page actuelle ont été traitées.',
            failedAllDoneLog: 'Toutes les tâches Failed de la page actuelle ont été traitées',
            missingMenu: 'La ligne {index} n’a pas de bouton de menu ; ignorée',
            missingClone: 'La ligne {index} n’a pas d’option Clone ; ignorée',
            missingCloneContinue: 'Continue introuvable après clonage ; tâche ignorée',
            missingConfirmError: 'La boîte de confirmation n’est pas apparue',
            failedSubmitted: 'Tâche échouée {index} envoyée',
            failedStopped: 'Relance des échecs arrêtée : {message}',
            runStarted: 'Exécution démarrée',
            runEnded: 'Exécution terminée'
        }
    };

    const downloadEnglish = {
        downloadTitle: 'Select jobs by date', downloadStart: 'From', downloadEnd: 'Through',
        downloadNote: 'Modified date, including both days. Scan all pages of the current Completed search results.',
        downloadScan: 'Find jobs', downloadAll: 'Select all', downloadClear: 'Clear selection',
        downloadIdle: 'Choose dates, find jobs, then apply your reviewed selection to the website.',
        downloadScanning: 'Scanning page {page}… {count} matches',
        downloadFound: '{count} matches; {selected} selected. Unknown dates skipped: {unknown}.',
        downloadHint: 'Apply replaces the website checkboxes. Combined: click the website Download for one ZIP (up to 50 jobs). Separate: download the current job on the website, then click Next job to select another. Next job only changes checkboxes; it does not verify saved files.',
        downloadFormat: 'Download mode', downloadCombined: 'Combined ZIP (website limit: 50)', downloadIndividual: 'Separate ZIPs (select one at a time)',
        downloadNext: 'Next job', downloadQueue: 'Current job {index}/{total}: {name} · {modified}',
        downloadQueueLast: 'This is the last job. Click the website Download manually.',
        downloadQueueInvalid: 'The individual selection queue was reset. Review the selection and apply it again.',
        downloadIndividualApplied: 'One job selected on the website. Click its original Download button, then use Next job to select another.',
        downloadReadyIndividual: 'Ready: download the current job on the website',
        downloadApply: 'Apply selection to website',
        downloadStandby: 'Standby: switch to Completed only',
        downloadReadyApply: 'Ready: review and apply your selection', downloadReadyWeb: 'Ready: {count} currently selected on website; use its Download button manually',
        downloadReadyFind: 'Ready: find jobs by date', downloadReadySelect: 'Ready: select jobs',
        downloadRunningScan: 'Running: finding jobs', downloadRunningApply: 'Running: selecting jobs on website',
        downloadSubmissionBusy: 'Standby: submission is running',
        downloadApplied: '{count} jobs selected on the website. Click the website’s original Download button to download.',
        downloadAppliedLimit: '{count} jobs selected on the website. Its bulk Download supports up to 50 at a time; reduce the website selection before clicking Download.',
        downloadLimit: 'Website bulk Download supports up to 50 jobs. Reduce the website selection or download jobs individually from their menus.',
        downloadNativeMissing: 'Cannot identify the website selection controls. Check the website and try again.',
        downloadNativeMismatch: 'Website selections include jobs outside this history or changed during the operation. Check the website selection and try again.',
        downloadNativeChanged: 'Website checkboxes changed during the operation. Selection stopped.',
        downloadApplyConfirm: 'Replace the website checkbox selection with these {count} jobs? Download afterward using the website’s own Download button.',
        downloadIndividualConfirm: 'Queue these {count} jobs and replace the website checkboxes with the first job? Next job will replace them with each following job. Download each job manually using the website Download button.',
        downloadReadyFooter: 'Use the website’s original Download button after selecting jobs.',
        downloadStopped: 'Selection stopped. Some website checkboxes may already have changed; review them or apply the selection again.',
        downloadError: '{detail} Some website checkboxes may already have changed; review them or apply the selection again.',
        downloadInvalidRange: 'Enter valid start and end dates; the start must not be after the end.',
        downloadNeedCompleted: 'In the website history, select only Completed before finding jobs.',
        downloadNoHistory: 'Cannot identify one history table with Name and Modified columns.',
        downloadPageError: 'Pagination did not finish or repeated a page. Find jobs again after checking the website.',
        downloadContextChanged: 'The history filters, search, order, or page size changed. Find jobs again.',
        downloadAmbiguous: 'Some jobs have the same name and Modified time and cannot be distinguished. Narrow the website search.',
        downloadNoSelection: 'Select at least one job from a completed scan.',
        downloadMissing: 'A selected job changed or could not be found. Selection stopped.',
        downloadIncomplete: 'Scan stopped or incomplete. Find jobs again before applying the selection.',
        downloadDay: '{day} · {count} jobs', downloadUnknown: 'Unknown date',
    };
    const downloadTranslations = {
        zh: {
            downloadTitle: '按日期选择任务', downloadStart: '开始日期', downloadEnd: '结束日期',
            downloadNote: '按官网 Modified 日期，包含起止当天。扫描当前 Completed 搜索结果的所有分页。',
            downloadScan: '查找任务', downloadAll: '全选', downloadClear: '清空选择',
            downloadIdle: '先选择日期并查找任务，核对后将勾选应用到官网。',
            downloadScanning: '正在扫描第 {page} 页…已找到 {count} 个',
            downloadFound: '匹配 {count} 个，已选 {selected} 个；日期无法识别、未纳入 {unknown} 个。',
            downloadHint: '应用会替换官网勾选。合并：手动点击官网 Download，最多 50 个任务合成一个 ZIP。分开：在官网下载当前任务后，点“下一任务”切换勾选；此按钮只切换任务，不检测文件是否保存。',
            downloadFormat: '下载方式', downloadCombined: '合并一个 ZIP（官网最多 50 个）', downloadIndividual: '分开下载（逐个勾选）',
            downloadNext: '下一任务', downloadQueue: '当前第 {index}/{total} 个：{name} · {modified}',
            downloadQueueLast: '已到最后一个任务，请手动点击官网 Download。',
            downloadQueueInvalid: '逐个勾选队列已重置，请核对选择后重新应用。',
            downloadIndividualApplied: '已在官网勾选当前任务。请手动点击官网原生 Download，之后点“下一任务”切换勾选。',
            downloadReadyIndividual: '就绪：请在官网下载当前任务',
            downloadApply: '应用到官网勾选',
            downloadStandby: '待机中：请切换到仅选 Completed 的页面',
            downloadReadyApply: '就绪：核对选择后应用到官网勾选', downloadReadyWeb: '就绪：官网当前已选 {count} 个，请手动点击官网 Download',
            downloadReadyFind: '就绪：按日期查找任务', downloadReadySelect: '就绪：请勾选任务',
            downloadRunningScan: '运行中：正在查找任务', downloadRunningApply: '运行中：正在网页中勾选',
            downloadSubmissionBusy: '待机中：正在提交任务',
            downloadApplied: '已在官网勾选 {count} 个任务，请手动点击官网原生 Download 按钮下载。',
            downloadAppliedLimit: '已在官网勾选 {count} 个任务；官网批量下载每次最多 50 个，请减少官网勾选后手动点击 Download。',
            downloadLimit: '官网批量下载每次最多 50 个任务，请减少官网勾选，或使用各任务行菜单中的 Download。',
            downloadNativeMissing: '无法识别官网勾选控件，请核对官网后重试。',
            downloadNativeMismatch: '官网勾选包含当前列表以外的任务，或勾选已变化。请核对官网选择后重试。',
            downloadNativeChanged: '运行期间官网勾选发生变化，已停止应用。',
            downloadApplyConfirm: '将官网勾选替换为这 {count} 个任务？随后请手动使用官网原生 Download 按钮下载。',
            downloadIndividualConfirm: '将这 {count} 个任务加入逐个勾选队列，并用第一个任务替换官网勾选？之后“下一任务”也会替换官网勾选。每个任务都请手动点击官网 Download 下载。',
            downloadReadyFooter: '勾选完成后，请手动使用官网原生 Download 按钮下载。',
            downloadStopped: '已停止应用；官网可能保留部分勾选，请核对或重新应用。',
            downloadError: '{detail} 官网可能保留部分勾选，请核对或重新应用。',
            downloadInvalidRange: '请填写有效的起止日期，开始日期不能晚于结束日期。',
            downloadNeedCompleted: '请先在官网历史列表中仅选中 Completed，再查找任务。',
            downloadNoHistory: '未能识别唯一的 Name / Modified 历史列表。',
            downloadPageError: '分页未完成或重复，请核对官网后重新查找任务。',
            downloadContextChanged: '官网的筛选、搜索、排序或每页数量已变化，请重新查找任务。',
            downloadAmbiguous: '有任务的名称和 Modified 时间完全相同，无法唯一识别。请缩小官网搜索范围。',
            downloadNoSelection: '请先完成查找，并至少勾选一个任务。',
            downloadMissing: '所选任务已变化或未找到，已停止应用。',
            downloadIncomplete: '查找已停止或未完成，请重新查找后再应用勾选。',
            downloadDay: '{day} · {count} 个', downloadUnknown: '日期无法识别',
        },
        ja: { downloadTitle: '日付でジョブを選択', downloadStart: '開始日', downloadEnd: '終了日', downloadScan: 'ジョブを検索', downloadAll: '全選択', downloadClear: '選択解除', downloadApply: '公式サイトの選択に反映' },
        ko: { downloadTitle: '날짜별 작업 선택', downloadStart: '시작일', downloadEnd: '종료일', downloadScan: '작업 찾기', downloadAll: '전체 선택', downloadClear: '선택 해제', downloadApply: '웹사이트 선택에 적용' },
        es: { downloadTitle: 'Seleccionar por fecha', downloadStart: 'Desde', downloadEnd: 'Hasta', downloadScan: 'Buscar tareas', downloadAll: 'Seleccionar todo', downloadClear: 'Borrar selección', downloadApply: 'Aplicar selección en la web' },
        fr: { downloadTitle: 'Sélectionner par date', downloadStart: 'Du', downloadEnd: 'Au', downloadScan: 'Rechercher', downloadAll: 'Tout sélectionner', downloadClear: 'Tout désélectionner', downloadApply: 'Appliquer la sélection au site' },
    };
    for (const language of Object.keys(I18N)) {
        Object.assign(I18N[language], downloadEnglish, downloadTranslations[language] || {});
    }

    if (window.__af3AutoSubmitterDevLoaded) return;
    window.__af3AutoSubmitterDevLoaded = true;

    let isRunning = false;
    let shouldStop = false;
    let isPaused = false;
    // Keep this guard after a batch ends. Re-enabling the UI is not evidence
    // that a request was rejected; the user must reconcile it before reloading.
    let submissionBlockReason = '';
    let isDraggingPanel = false;
    let isResizingPanel = false;
    let panelSize = null;
    const downloadState = {
        busy: false, stop: false, complete: false, jobs: [], selected: new Set(),
        unknown: 0, context: null, scanContext: null, message: '', messageVars: {}, phase: '',
        watchNative: false, nativeMutation: false, selectionChanged: false,
        format: getSavedDownloadFormat(), queue: null,
    };
    let logExpanded = false;
    let currentLanguage = getSavedLanguage();
    let runProgress = {
        active: false,
        current: 0,
        total: 0,
        success: 0,
        skipped: 0,
        errors: 0,
        status: 'idle',
        skippedTasks: [],
        failedTasks: []
    };
    const logEntries = [];
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function getSavedDownloadFormat() {
        try { return localStorage.getItem(DOWNLOAD_FORMAT_KEY) === 'individual' ? 'individual' : 'combined'; }
        catch (_) { return 'combined'; }
    }

    function getSavedLanguage() {
        try {
            const saved = localStorage.getItem(LANGUAGE_KEY);
            return I18N[saved] ? saved : 'zh';
        } catch (e) {
            return 'zh';
        }
    }

    function saveLanguage(lang) {
        try {
            localStorage.setItem(LANGUAGE_KEY, lang);
        } catch (e) {
            // Ignore storage errors; Chinese remains the default fallback.
        }
    }

    function t(key, vars = {}) {
        const dict = I18N[currentLanguage] || I18N.zh;
        const template = dict[key] || I18N.zh[key] || key;
        return template.replace(/\{(\w+)\}/g, (_, name) => Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : '');
    }

    function makeStoppedError() {
        const error = new Error(t('userStoppedError'));
        error.isUserStop = true;
        return error;
    }

    function isUserStopError(error) {
        return Boolean(error && error.isUserStop);
    }

    function applyLanguage() {
        const header = getUiElement('af3-header');
        const languageSelect = getUiElement('af3-language-select');
        const input = getUiElement('af3-v20-count');
        const footer = getUiElement('af3-footer-msg');
        const statusText = getUiElement('af3-status-text');

        if (header) header.textContent = `${t('headerDev')} ${SCRIPT_VERSION}`;
        if (languageSelect) {
            languageSelect.value = currentLanguage;
            languageSelect.title = t('languageTitle');
        }
        if (input) input.title = t('confirmPlan', { count: input.value || 0 });
        const resizeHandle = getUiElement('af3-resize-handle');
        if (resizeHandle) {
            resizeHandle.title = t('resizePanel');
            resizeHandle.setAttribute('aria-label', t('resizePanel'));
        }
        updateQuota();
        renderDownloadSection();
        renderLogPanel();
        updateRunControls();

        if (isRunning) {
            updateBtnText(isPaused ? t('pausedButton') : t('runningButton'));
        } else {
            updateBtnText(t('startButton'));
            checkSystemStatus();
        }

        if (!footer && statusText) statusText.textContent = t('initializing');
    }

    function getPanelHost() {
        return document.getElementById(CONTAINER_ID);
    }

    function getUiElement(id) {
        return getPanelHost()?.shadowRoot?.getElementById(id) || document.getElementById(id) || null;
    }

    function getSavedPanelPosition() {
        try {
            const raw = localStorage.getItem(PANEL_POSITION_KEY);
            if (!raw) return null;
            const pos = JSON.parse(raw);
            if (!Number.isFinite(pos.left) || !Number.isFinite(pos.top)) return null;
            return pos;
        } catch (e) {
            return null;
        }
    }

    function savePanelPosition(host) {
        const rect = host.getBoundingClientRect();
        try {
            localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify({
                left: Math.round(rect.left),
                top: Math.round(rect.top)
            }));
        } catch (e) {
            // localStorage can be unavailable in strict browser configurations.
        }
    }

    function getSavedPanelSize() {
        if (panelSize) return panelSize;
        try {
            const size = JSON.parse(localStorage.getItem(PANEL_SIZE_KEY));
            if (Number.isFinite(size?.width) && size.width > 0 &&
                Number.isFinite(size?.height) && size.height > 0) return panelSize = size;
        } catch (e) {
            // Storage may be disabled or contain an outdated value.
        }
        return panelSize = { width: 300, height: 380 };
    }

    function clampPanelSize(size) {
        const availableWidth = Math.max(1, window.innerWidth - 24);
        const availableHeight = Math.max(1, window.innerHeight - 24);
        return {
            width: Math.min(Math.max(Math.min(240, availableWidth), size.width), availableWidth),
            height: Math.min(Math.max(Math.min(260, availableHeight), size.height), availableHeight)
        };
    }

    function savePanelSize(host) {
        const rect = host.getBoundingClientRect();
        panelSize = { width: Math.round(rect.width), height: Math.round(rect.height) };
        try {
            localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(panelSize));
        } catch (e) {
            // Resizing still works when persistent storage is unavailable.
        }
    }

    function applyHostStyle(host) {
        if (isDraggingPanel || isResizingPanel) return;
        const savedPosition = getSavedPanelPosition();
        const size = clampPanelSize(getSavedPanelSize());
        Object.assign(host.style, {
            position: 'fixed',
            zIndex: '2147483647',
            display: 'block',
            visibility: 'visible',
            opacity: '1',
            pointerEvents: 'auto',
            width: size.width + 'px',
            maxWidth: 'calc(100vw - 24px)',
            height: size.height + 'px',
            maxHeight: 'calc(100vh - 24px)',
            colorScheme: 'light',
            transform: 'none'
        });

        const position = savedPosition || { left: window.innerWidth - size.width - 30, top: 80 };
        host.style.left = Math.min(Math.max(12, position.left), Math.max(12, window.innerWidth - size.width - 12)) + 'px';
        host.style.top = Math.min(Math.max(12, position.top), Math.max(12, window.innerHeight - size.height - 12)) + 'px';
        host.style.right = 'auto';
    }

    function readQuota(root) {
        if (!root) return null;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const parts = [];
        while (walker.nextNode()) {
            const parent = walker.currentNode.parentElement;
            if (!parent || parent.closest('mat-icon, svg, script, style') ||
                !parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden') continue;
            parts.push(walker.currentNode.textContent);
        }
        const matches = [...parts.join(' ').replace(/\s+/g, ' ').matchAll(/\bRemaining jobs:\s*(\d+)\b(?![.,]\d)/gi)];
        if (matches.length !== 1) return null;
        const quota = Number(matches[0][1]);
        return Number.isSafeInteger(quota) ? quota : null;
    }

    function updateQuota() {
        const target = getUiElement('af3-quota');
        if (!target) return;
        const preview = Array.from(document.querySelectorAll('gdm-af-preview-dialog'))
            .find(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
        const points = Array.from(document.querySelectorAll('gdm-af-request .points'))
            .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
        const quota = preview ? readQuota(preview) : points.length === 1 ? readQuota(points[0]) : null;
        const message = quota === null ? t('quotaUnknown') :
            t('quotaRemaining', { count: quota }) + (preview ? t('quotaPreview') : '');
        if (target.textContent !== message) target.textContent = message;
    }

    function addLog(message, level = 'info') {
        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        logEntries.push({ time, message, level });
        if (logEntries.length > 40) logEntries.shift();

        const consoleFn = level === 'warn' ? console.warn : level === 'error' ? console.error : console.log;
        consoleFn(`[AF3] ${message}`);
        renderLogPanel();
    }

    function startRunProgress(total) {
        runProgress = {
            active: true,
            current: 0,
            total,
            success: 0,
            skipped: 0,
            errors: 0,
            status: 'running',
            skippedTasks: [],
            failedTasks: []
        };
    }

    function setProgressCurrent(current) {
        runProgress.current = Math.min(current, runProgress.total || current);
    }

    function getTaskLabel(row, fallback) {
        const text = row?.textContent?.replace(/\s+/g, ' ').trim();
        if (!text) return fallback;
        return text.length > 80 ? `${text.slice(0, 77)}...` : text;
    }

    function recordProgressResult(type, task = {}) {
        const entry = {
            label: task.label || '-',
            reason: task.reason || ''
        };
        if (type === 'success') runProgress.success++;
        if (type === 'skipped') {
            runProgress.skipped++;
            runProgress.skippedTasks.push(entry);
        }
        if (type === 'error') {
            runProgress.errors++;
            runProgress.failedTasks.push(entry);
        }
    }

    function formatTaskList(titleKey, tasks) {
        if (!tasks.length) return '';
        const visible = tasks.slice(0, 5).map(task => t('taskSummaryLine', {
            label: task.label,
            reason: task.reason || '-'
        }));
        if (tasks.length > visible.length) {
            visible.push(t('moreTasks', { count: tasks.length - visible.length }));
        }
        return `\n\n${t(titleKey)}\n${visible.join('\n')}`;
    }

    function finishRunProgress(status, detail = '') {
        runProgress.active = false;
        runProgress.status = status;

        const title = status === 'stopped'
            ? t('batchStopped')
            : status === 'error'
                ? t('batchError')
                : t('batchDone');
        const detailText = detail ? `\n\n${t('reason', { detail })}` : '';
        const summary =
            `${title}\n\n` +
            `${t('summaryDone', { count: runProgress.success })}\n` +
            `${t('summarySkipped', { count: runProgress.skipped })}\n` +
            `${t('summaryFailed', { count: runProgress.errors })}` +
            formatTaskList('failedTasksTitle', runProgress.failedTasks) +
            formatTaskList('skippedTasksTitle', runProgress.skippedTasks) +
            `${detailText}\n\n` +
            t('viewLogsHint');

        addLog(t('runSummaryLog', {
            success: runProgress.success,
            skipped: runProgress.skipped,
            errors: runProgress.errors
        }));
        alert(summary);
    }

    function renderLogPanel() {
        const toggle = getUiElement('af3-log-toggle');
        const body = getUiElement('af3-log-body');

        if (toggle) toggle.textContent = `${logExpanded ? '▼' : '▶'} ${t('logLabel')} (${logEntries.length})`;
        if (!body) return;

        body.style.display = logExpanded ? 'block' : 'none';
        body.textContent = logEntries.map(entry => `[${entry.time}] ${entry.message}`).join('\n');
        if (logExpanded) body.scrollTop = body.scrollHeight;
    }

    function toggleLogPanel() {
        logExpanded = !logExpanded;
        renderLogPanel();
    }

    function requestStop() {
        if (!isRunning) return;
        shouldStop = true;
        isPaused = false;
        addLog(t('stopRequested'), 'warn');
        updateBtnText(t('stoppingButton'));
        updateRunControls();
    }

    function togglePause() {
        if (!isRunning) return;
        isPaused = !isPaused;
        addLog(isPaused ? t('pausedLog') : t('resumedLog'));
        updateBtnText(isPaused ? t('pausedButton') : t('runningButton'));
        updateRunControls();
    }

    function checkStop() {
        if (shouldStop) throw makeStoppedError();
    }

    async function waitIfPaused() {
        while (isPaused && !shouldStop) {
            updateBtnText(t('pausedButton'));
            await sleep(300);
        }
        checkStop();
    }

    async function controlledSleep(ms) {
        let elapsed = 0;
        while (elapsed < ms) {
            await waitIfPaused();
            const step = Math.min(250, ms - elapsed);
            await sleep(step);
            elapsed += step;
        }
        checkStop();
    }

    function getModeLabel() {
        if (currentMode === 'DRAFT') return t('modeDraft');
        if (currentMode === 'FAILED') return t('modeFailed');
        return t('modeUnknown');
    }

    function confirmStart(maxJobs) {
        const rows = getRows();
        const rowCount = rows.length;
        const plannedJobs = Math.min(maxJobs, rowCount);

        if (rowCount === 0) {
            alert(t('noRowsAlert'));
            addLog(t('noRowsLog'), 'warn');
            return 0;
        }

        const ok = confirm(
            `${t('confirmTitle')}\n\n` +
            `${t('confirmMode', { mode: getModeLabel() })}\n` +
            `${t('confirmRows', { count: rowCount })}\n` +
            `${t('confirmPlan', { count: plannedJobs })}\n\n` +
            t('confirmPrompt')
        );

        if (!ok) {
            addLog(t('userCancelled'));
            return 0;
        }

        addLog(t('startConfirmed', { mode: getModeLabel(), planned: plannedJobs, rows: rowCount }));
        return plannedJobs;
    }

    // Watch only official snackbar containers, never our own status or logs.
    // A closed dialog or a refreshed row cannot confirm a server-side launch.
    async function submitAndConfirm(confirmButton) {
        await waitIfPaused();
        if (!confirmButton?.isConnected || confirmButton.disabled ||
            confirmButton.getAttribute('aria-disabled') === 'true' || confirmButton.offsetParent === null) {
            throw new Error(t('submissionNotReady'));
        }
        const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
        const notices = () => Array.from(document.querySelectorAll('mat-snack-bar-container, .mat-mdc-snack-bar-container'));
        const readNotice = node => {
            const copy = node.cloneNode(true);
            copy.querySelectorAll('mat-icon, svg').forEach(icon => icon.remove());
            return normalize(copy.textContent);
        };
        const seen = new Map(notices().map(node => [node, readNotice(node)]));
        let result = null;
        const observer = new MutationObserver(() => {
            for (const node of notices()) {
                const message = readNotice(node);
                if (seen.get(node) === message) continue;
                seen.set(node, message);
                if (/failed to launch|\berror\b|\bfailed\b|quota|too many requests|rate limit|unauthenticated/i.test(message)) {
                    result = new Error(t('submissionServerError', { message }));
                } else if (/\bJob successfully launched\./i.test(message) && !(result instanceof Error)) {
                    result = true;
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        try {
            checkStop();
            submissionBlockReason = t('submissionUncertain');
            updateBtnText(t('verifyingSubmission'));
            const deadline = Date.now() + SUBMISSION_TIMEOUT;
            // Dispatch exactly one click. Never retry a pending request.
            confirmButton.click();
            while (Date.now() < deadline) {
                if (result instanceof Error) {
                    submissionBlockReason = result.message;
                    throw result;
                }
                if (result === true) {
                    submissionBlockReason = '';
                    return;
                }
                // Pause must not suspend confirmation of a request already sent.
                // Stop interrupts the wait but retains the uncertainty guard.
                checkStop();
                await sleep(100);
            }
            throw new Error(t('submissionUncertain'));
        } finally {
            observer.disconnect();
        }
    }

    function getDraftIdentity(row) {
        const nameCell = row.querySelector('.mat-column-name, .cdk-column-name');
        return (nameCell || row).textContent.replace(/\s+/g, ' ').trim();
    }

    async function waitForDraftRemoval(identity) {
        const deadline = Date.now() + SUBMISSION_TIMEOUT;
        // Check by name, not DOM-node identity: rerendering can replace an
        // unchanged row. Keep success counted if this secondary check fails.
        while (getRows().some(row => getDraftIdentity(row) === identity)) {
            if (Date.now() >= deadline || shouldStop) {
                submissionBlockReason = t('draftListUnchanged');
                if (shouldStop) throw makeStoppedError();
                throw new Error(submissionBlockReason);
            }
            await sleep(100);
        }
    }

    // --- 通用查找工具 ---
    function findButtonByText(text) {
        const els = Array.from(document.querySelectorAll('button, div[role="button"], span[role="button"]'));
        return els.find(el =>
            el.textContent &&
            el.textContent.toLowerCase().includes(text.toLowerCase()) &&
            !el.disabled &&
            el.offsetParent !== null
        );
    }

    // 获取列表行 (兼容 Draft 和 Failed 页面)
    function getRows() {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        const listItems = checkboxes.map(cb => {
            let parent = cb.parentElement;
            while(parent && parent.tagName !== 'TR' && !parent.getAttribute('role')?.includes('row') && parent.className.indexOf('row') === -1) {
                parent = parent.parentElement;
                if (!parent || parent === document.body) return null;
            }
            return parent;
        }).filter(row => row !== null);
        return [...new Set(listItems)].filter(r => !r.textContent.includes('Name'));
    }

    // 强力点击
    function simulateClick(element, color = 'rgba(255, 0, 0, 0.3)') {
        if (!element) return;
        const originalBg = element.style.backgroundColor;
        const originalTrans = element.style.transition;

        // 视觉反馈
        element.style.backgroundColor = color;
        element.style.transition = 'background 0.2s';
        setTimeout(() => {
            element.style.backgroundColor = originalBg;
            element.style.transition = originalTrans;
        }, 300);

        // 完整事件链
        const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
        element.dispatchEvent(new MouseEvent('mouseover', opts));
        element.dispatchEvent(new MouseEvent('mousedown', opts));
        element.dispatchEvent(new MouseEvent('mouseup', opts));
        element.click();
    }

    // --- 失败重跑特有逻辑 ---

    // 1. 点击某行的“三点”菜单
    async function clickMenuOnRow(row) {
        // 策略：找行内的 button，通常最后一个是菜单
        const buttons = Array.from(row.querySelectorAll('button'));
        if (buttons.length === 0) return false;

        const menuBtn = buttons[buttons.length - 1];

        addLog(t('clickRowMenu'));
        simulateClick(menuBtn, 'rgba(0, 0, 255, 0.3)');
        return true;
    }

    // 2. 【核心修复】全屏搜索 "Clone and reuse" 文字并点击
    async function clickCloneOption() {
        addLog(t('lookingClone'));

        // 轮询机制：菜单弹出可能有动画，我们给它 2秒 时间反复找
        for(let i = 0; i < 10; i++) {
            await controlledSleep(200); // 每次等 200ms

            // 搜索策略：不局限于 li/div，直接找包含文字的“最小节点”
            // 很多框架把文字放在 span 里，span 放在 div 里，div 放在 li 里
            // 我们找到文字节点，然后往上找最近的可点击元素

            // 获取所有包含 "Clone and reuse" 的元素
            // 这里使用 TreeWalker 或者简单的 querySelectorAll 遍历效率稍低但稳
            // 简单点：找 body 下所有包含该文本的元素

            const allElements = document.body.querySelectorAll('*');
            let target = null;

            for (let el of allElements) {
                // 必须是肉眼可见的
                if (el.offsetParent === null) continue;

                // 只有当它是“叶子节点”（没有子标签）且包含文字时，才是我们要找的最底层元素
                if (el.children.length === 0 && el.textContent && el.textContent.includes("Clone and reuse")) {
                    target = el;
                    break;
                }
            }

            if (target) {
                // 找到了文字节点（比如 span）。
                // 尝试点击它，或者它的父级菜单项。
                // 为了保险，我们优先找它的 li 或 role="menuitem" 父级
                const clickable = target.closest('li') || target.closest('[role="menuitem"]') || target.closest('button') || target;

                addLog(t('foundClone'));
                simulateClick(clickable, 'rgba(0, 255, 0, 0.5)'); // 绿色高亮
                return true;
            }
        }

        return false;
    }

    // 3. 返回 Failed 列表页
    async function backToFailedTab() {
        addLog(t('backFailedTab'));
        const tabs = Array.from(document.querySelectorAll('button[role="tab"], div[role="tab"]'));
        const failedTab = tabs.find(t => t.textContent.includes("Failed"));

        if (failedTab) {
            simulateClick(failedTab);
            return true;
        }
        return false;
    }

    // Read the public history UI and apply reviewed checkbox selections only.
    // Downloads remain under the user's control through the website's own UI.
    function downloadVisible(node) {
        return Boolean(node?.isConnected && node.getClientRects().length &&
            getComputedStyle(node).visibility !== 'hidden');
    }

    function downloadText(node) {
        if (!node) return '';
        const copy = node.cloneNode(true);
        copy.querySelectorAll('mat-icon, svg, input').forEach(child => child.remove());
        return copy.textContent.replace(/\s+/g, ' ').trim();
    }

    function validDownloadDay(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
        if (!match) return false;
        const [, year, month, day] = match.map(Number);
        const date = new Date(0);
        date.setUTCFullYear(year, month - 1, day);
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    }

    function downloadHistoryLoading(root = document) {
        return Array.from(root.querySelectorAll('mat-spinner, mat-progress-bar, mat-progress-spinner, [aria-busy="true"]')).some(downloadVisible);
    }

    function getDownloadHistory(allowLoading = false) {
        const histories = Array.from(document.querySelectorAll('table')).filter(downloadVisible).map(table => {
            const headers = Array.from(table.querySelectorAll('thead th, tr th, [role="columnheader"]'));
            const labels = headers.map(downloadText);
            return { table, root: table.closest('gdm-af-history') || document, nameIndex: labels.indexOf('Name'), dateIndex: labels.indexOf('Modified') };
        }).filter(history => history.nameIndex >= 0 && history.dateIndex >= 0);
        if (!histories.length) {
            const empty = Array.from(document.querySelectorAll('gdm-af-history')).filter(downloadVisible).filter(root =>
                Array.from(root.querySelectorAll('.no-results')).some(node => downloadVisible(node) &&
                    /^No jobs found with (?:this search term|filters specified)$/.test(downloadText(node))));
            if (empty.length === 1) return { table: null, root: empty[0], nameIndex: -1, dateIndex: -1 };
            if (allowLoading) {
                const loading = Array.from(document.querySelectorAll('gdm-af-history')).filter(downloadVisible).filter(downloadHistoryLoading);
                if (loading.length === 1) return { table: null, root: loading[0], loading: true, nameIndex: -1, dateIndex: -1 };
            }
        }
        if (histories.length !== 1) throw new Error(t('downloadNoHistory'));
        return { ...histories[0], loading: allowLoading && downloadHistoryLoading(histories[0].root) };
    }

    function getSelectedHistoryStatuses(root = null) {
        if (!root) {
            const histories = Array.from(document.querySelectorAll('gdm-af-history')).filter(downloadVisible);
            if (histories.length > 1) return [];
            root = histories[0] || document;
        }
        const chips = root.querySelectorAll('mat-chip-option');
        const filters = Array.from(chips.length ? chips : root.querySelectorAll('[role="tab"], [role="option"]'))
            .filter(downloadVisible).map(node => ({
                name: downloadText(node),
                selected: ['aria-selected', 'aria-pressed', 'aria-checked'].some(attr => node.getAttribute(attr) === 'true') ||
                    Boolean(node.querySelector('[aria-selected="true"], [aria-pressed="true"], [aria-checked="true"]')) ||
                    node.classList.contains('mat-mdc-chip-selected') || node.classList.contains('mdc-evolution-chip--selected'),
            })).filter(item => /^(Completed|Saved draft|In progress|Examples|Failed)$/i.test(item.name));
        return [...new Set(filters.filter(item => item.selected).map(item => item.name.toLowerCase()))].sort();
    }

    function getDownloadContext() {
        const { table, root, loading } = getDownloadHistory(true);
        const previous = loading && downloadState.context ? JSON.parse(downloadState.context) : null;
        const selected = getSelectedHistoryStatuses(root);
        if (selected.length !== 1 || selected[0] !== 'completed') throw new Error(t('downloadNeedCompleted'));
        const search = root.querySelector('input[placeholder="Search History"], input[aria-label="Search History"]');
        const sort = loading ? previous?.sort || [] : Array.from(table?.querySelectorAll('th[aria-sort]') || []).map(node => [downloadText(node), node.getAttribute('aria-sort')]);
        const pageSize = root.querySelector('mat-paginator .mat-mdc-select-value, mat-paginator select');
        return JSON.stringify({ url: location.href, selected, search: search?.value || '', sort, pageSize: pageSize?.value || pageSize?.textContent || (loading ? previous?.pageSize || '' : '') });
    }

    function checkDownloadActive() {
        if (downloadState.stop) throw makeStoppedError();
        if (downloadState.selectionChanged) throw new Error(t('downloadNativeChanged'));
        if (downloadState.context !== getDownloadContext()) throw new Error(t('downloadContextChanged'));
    }

    async function downloadDelay(ms) {
        const until = Date.now() + ms;
        do {
            checkDownloadActive();
            await sleep(Math.min(60, Math.max(0, until - Date.now())));
        } while (Date.now() < until);
        checkDownloadActive();
    }

    function readDownloadPage() {
        const { table, root, nameIndex, dateIndex } = getDownloadHistory();
        const rows = Array.from(table?.querySelectorAll('tbody tr, tr.mat-mdc-row, tr[mat-row]') || []).filter(downloadVisible);
        const jobs = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            const name = downloadText(cells[nameIndex]);
            const modified = downloadText(cells[dateIndex]);
            const match = /^(\d{4}-\d{2}-\d{2})(?:\s+(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)?$/.exec(modified);
            const day = match && validDownloadDay(match[1]) ? match[1] : null;
            // Use a native public job link/ID when present. Otherwise require a
            // unique name and full displayed Modified time throughout the scan.
            const link = Array.from(row.querySelectorAll('a[href]')).map(a => a.getAttribute('href'))
                .find(href => /^\/(?:job|jobs|fold)\//.test(href));
            const id = row.getAttribute('data-job-id') || link;
            if (!name) throw new Error(t('downloadNoHistory'));
            return { key: id ? `id:${id}` : `row:${JSON.stringify([name, modified])}`, id: Boolean(id), name, modified, day, row };
        });
        const keys = new Set();
        for (const job of jobs) {
            if (keys.has(job.key)) throw new Error(t(job.id ? 'downloadPageError' : 'downloadAmbiguous'));
            keys.add(job.key);
        }
        const paginators = Array.from(root.querySelectorAll('mat-paginator')).filter(downloadVisible);
        if (paginators.length > 1) throw new Error(t('downloadPageError'));
        const paginator = paginators[0] || null;
        const control = (className, label) => paginator?.querySelector(`button.${className}, button[aria-label="${label}"]`) || null;
        const first = control('mat-mdc-paginator-navigation-first', 'First page');
        const previous = control('mat-mdc-paginator-navigation-previous', 'Previous page');
        const next = control('mat-mdc-paginator-navigation-next', 'Next page');
        if (paginator && (!previous || !next)) throw new Error(t('downloadPageError'));
        const range = paginator?.querySelector('.mat-mdc-paginator-range-label')?.textContent?.trim() || '';
        return { jobs, first, previous, next, signature: JSON.stringify([range, jobs.map(job => [job.key, job.modified])]) };
    }

    function downloadButtonEnabled(button) {
        return downloadVisible(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
    }

    async function waitDownloadPage(before = null) {
        const deadline = Date.now() + 8000;
        let stable = '', stableSince = 0;
        while (Date.now() < deadline) {
            await downloadDelay(70);
            const { root } = getDownloadHistory(true);
            if (downloadHistoryLoading(root)) { stable = ''; continue; }
            const page = readDownloadPage();
            if (before === null || page.signature !== before) {
                if (stable === page.signature && Date.now() - stableSince >= 200) return page;
                if (stable !== page.signature) { stable = page.signature; stableSince = Date.now(); }
            } else { stable = ''; }
        }
        throw new Error(t('downloadPageError'));
    }

    async function moveDownloadPage(button, before) {
        checkDownloadActive();
        if (!downloadButtonEnabled(button)) throw new Error(t('downloadPageError'));
        button.click();
        return waitDownloadPage(before);
    }

    async function firstDownloadPage() {
        let page = await waitDownloadPage();
        if (downloadButtonEnabled(page.first)) return moveDownloadPage(page.first, page.signature);
        const visited = new Set();
        while (downloadButtonEnabled(page.previous)) {
            if (visited.has(page.signature) || visited.size >= 1000) throw new Error(t('downloadPageError'));
            visited.add(page.signature);
            page = await moveDownloadPage(page.previous, page.signature);
        }
        return page;
    }

    function getNativeDownloadToolbar() {
        const { root } = getDownloadHistory(true);
        const buttons = Array.from(root.querySelectorAll('button.download-button')).filter(downloadVisible);
        if (!buttons.length) return { count: 0, button: null, clear: null };
        if (buttons.length !== 1) throw new Error(t('downloadNativeMissing'));
        const button = buttons[0];
        const row = button.closest('.row');
        const match = /\b(\d+)\s+selected\b/i.exec(downloadText(row));
        const clear = Array.from(row?.querySelectorAll('button') || []).find(node =>
            node.querySelector('mat-icon')?.textContent.trim() === 'close');
        if (!match || !clear) throw new Error(t('downloadNativeMissing'));
        return { count: Number(match[1]), button, clear };
    }

    function nativeDownloadCheckbox(job) {
        const input = job.row.querySelector('.mat-column-selected input[type="checkbox"], td:first-child input[type="checkbox"]');
        // Material may make the actual input transparent; its host is visible.
        if (!input || input.disabled || !downloadVisible(job.row)) throw new Error(t('downloadNativeMissing'));
        return input;
    }

    function sameDownloadJob(job, target) {
        return Boolean(job && target && job.key === target.key && job.modified === target.modified && job.name === target.name && job.day === target.day);
    }

    function mutateNativeSelection(action) {
        downloadState.nativeMutation = true;
        try { action(); } finally { downloadState.nativeMutation = false; }
    }

    function resetDownloadQueue(message) {
        const hadQueue = Boolean(downloadState.queue);
        downloadState.queue = null;
        if (hadQueue && message) {
            downloadState.message = message;
            downloadState.messageVars = {};
        }
    }

    function nativeSelectionChanged() {
        if (downloadState.nativeMutation) return;
        if (downloadState.busy && downloadState.watchNative) downloadState.selectionChanged = true;
        else if (downloadState.queue) {
            resetDownloadQueue('downloadQueueInvalid');
            renderDownloadSection();
        }
    }

    document.addEventListener('change', event => {
        if (event.target.matches?.('input[type="checkbox"]') && event.target.closest('gdm-af-history')) nativeSelectionChanged();
    }, true);
    document.addEventListener('click', event => {
        if (downloadState.nativeMutation) return;
        const history = event.target.closest?.('gdm-af-history');
        if (!history) return;
        const button = event.target.closest('button');
        if (event.target.closest('.mat-column-selected, .select-all-checkbox') ||
            (button && button.querySelector('mat-icon')?.textContent.trim() === 'close')) nativeSelectionChanged();
    }, true);

    async function applyNativeDownloadSelection(records) {
        const targets = new Map(records.map(job => [job.key, job]));
        const initial = getNativeDownloadToolbar();
        if (initial.count) {
            if (!downloadButtonEnabled(initial.clear)) throw new Error(t('downloadNativeMissing'));
            mutateNativeSelection(() => initial.clear.click());
            await downloadDelay(70);
            if (getNativeDownloadToolbar().count !== 0) throw new Error(t('downloadNativeMismatch'));
        }
        let page = await firstDownloadPage();
        const visited = new Set();
        let selected = 0;
        while (targets.size) {
            checkDownloadActive();
            if (visited.has(page.signature) || visited.size >= 1000) throw new Error(t('downloadPageError'));
            visited.add(page.signature);
            for (const job of page.jobs) {
                const target = targets.get(job.key);
                if (!target) continue;
                const fresh = readDownloadPage().jobs.find(item => item.key === job.key);
                if (!sameDownloadJob(fresh, target)) throw new Error(t('downloadMissing'));
                const checkbox = nativeDownloadCheckbox(fresh);
                if (checkbox.checked) throw new Error(t('downloadNativeMismatch'));
                mutateNativeSelection(() => checkbox.click());
                await downloadDelay(70);
                const checked = readDownloadPage().jobs.find(item => item.key === job.key);
                if (!sameDownloadJob(checked, target) || !nativeDownloadCheckbox(checked).checked) throw new Error(t('downloadMissing'));
                selected++;
                if (getNativeDownloadToolbar().count !== selected) throw new Error(t('downloadNativeMismatch'));
                targets.delete(job.key);
            }
            if (!targets.size) break;
            if (!downloadButtonEnabled(page.next)) throw new Error(t('downloadMissing'));
            page = await moveDownloadPage(page.next, page.signature);
        }
        await firstDownloadPage();
        if (getNativeDownloadToolbar().count !== records.length) throw new Error(t('downloadNativeMismatch'));
    }

    async function collectNativeDownloadSelection() {
        const expected = getNativeDownloadToolbar().count;
        if (!expected) throw new Error(t('downloadNoSelection'));
        const records = [], identities = new Set(), visited = new Set();
        let page = await firstDownloadPage();
        while (true) {
            checkDownloadActive();
            if (getNativeDownloadToolbar().count !== expected) throw new Error(t('downloadNativeMismatch'));
            if (visited.has(page.signature) || visited.size >= 1000) throw new Error(t('downloadPageError'));
            visited.add(page.signature);
            for (const job of page.jobs) {
                if (identities.has(job.key)) throw new Error(t(job.id ? 'downloadPageError' : 'downloadAmbiguous'));
                identities.add(job.key);
                if (nativeDownloadCheckbox(job).checked) {
                    const { row, ...record } = job;
                    records.push(record);
                }
            }
            if (!downloadButtonEnabled(page.next)) break;
            page = await moveDownloadPage(page.next, page.signature);
        }
        await firstDownloadPage();
        if (records.length !== expected || getNativeDownloadToolbar().count !== expected) throw new Error(t('downloadNativeMismatch'));
        return records;
    }

    function downloadReadiness() {
        if (downloadState.busy) return { key: downloadState.phase === 'scan' ? 'downloadRunningScan' : 'downloadRunningApply', color: '#fbbc04' };
        if (isRunning) return { key: 'downloadSubmissionBusy', color: '#fbbc04' };
        let context;
        try { context = getDownloadContext(); }
        catch (_) { return { key: 'downloadStandby', color: '#f28b82' }; }
        if (downloadState.complete && context !== downloadState.scanContext) return { key: 'downloadContextChanged', color: '#fbbc04' };
        try {
            const { count } = getNativeDownloadToolbar();
            if (count > 50) return { key: 'downloadLimit', color: '#fbbc04' };
            if (count === 1 && downloadState.queue) return { key: 'downloadReadyIndividual', color: '#81c995' };
            if (count) return { key: 'downloadReadyWeb', vars: { count }, color: '#8ab4f8' };
            return { key: !downloadState.complete ? 'downloadReadyFind' : downloadState.selected.size ? 'downloadReadyApply' : 'downloadReadySelect', color: '#81c995' };
        } catch (_) { return { key: 'downloadNativeMissing', color: '#fbbc04' }; }
    }

    function updateDownloadReadiness() {
        const state = downloadReadiness();
        const message = t(state.key, state.vars);
        const text = getUiElement('af3-download-ready-text');
        if (text) { text.textContent = message; text.style.color = state.color; }
        const light = getUiElement('af3-download-ready-light');
        if (light) light.style.backgroundColor = state.color;
    }

    function setDownloadMessage(key, vars = {}) {
        downloadState.message = key;
        downloadState.messageVars = vars;
        renderDownloadSection();
    }

    function updateDownloadControls() {
        const busy = downloadState.busy || isRunning;
        if (!busy && downloadState.queue) {
            try {
                if (downloadState.queue.context !== getDownloadContext()) throw new Error();
            } catch (_) {
                resetDownloadQueue('downloadContextChanged');
                renderDownloadSection();
                return;
            }
        }
        for (const id of ['start', 'end', 'scan', 'all', 'clear', 'format']) {
            const control = getUiElement(`af3-download-${id}`);
            if (control) control.disabled = busy;
        }
        const apply = getUiElement('af3-download-apply');
        if (apply) apply.disabled = busy || !downloadState.complete || downloadState.selected.size === 0;
        const next = getUiElement('af3-download-next');
        if (next) {
            next.hidden = downloadState.format !== 'individual';
            next.disabled = busy || !downloadState.queue || downloadState.queue.index >= downloadState.queue.records.length - 1;
        }
        const stop = getUiElement('af3-download-stop');
        if (stop) {
            stop.hidden = !downloadState.busy;
            stop.disabled = !downloadState.busy || downloadState.stop;
        }
        getUiElement('af3-download-results')?.querySelectorAll('input').forEach(input => { input.disabled = busy; });
        updateDownloadReadiness();
    }

    function renderDownloadSection() {
        const section = getUiElement('af3-download-section');
        if (!section) return;
        section.querySelectorAll('[data-download-i18n]').forEach(node => { node.textContent = t(node.dataset.downloadI18n); });
        const status = getUiElement('af3-download-status');
        if (status) {
            const key = downloadState.message || 'downloadIdle';
            const vars = key === 'downloadFound' ? { count: downloadState.jobs.length, selected: downloadState.selected.size, unknown: downloadState.unknown } : downloadState.messageVars;
            status.textContent = key === 'error' ? downloadState.messageVars.detail : t(key, vars);
        }
        const queueText = getUiElement('af3-download-queue');
        if (queueText) {
            const queue = downloadState.queue;
            queueText.hidden = !queue;
            queueText.textContent = queue ? t('downloadQueue', { index: queue.index + 1, total: queue.records.length, ...queue.records[queue.index] }) +
                (queue.index === queue.records.length - 1 ? ' ' + t('downloadQueueLast') : '') : '';
        }
        const list = getUiElement('af3-download-results');
        if (list && (downloadState.renderedJobs !== downloadState.jobs || downloadState.renderedList !== list || downloadState.renderedLanguage !== currentLanguage)) {
            list.replaceChildren();
            const groups = new Map();
            for (const job of downloadState.jobs) {
                if (!groups.has(job.day)) groups.set(job.day, []);
                groups.get(job.day).push(job);
            }
            for (const [day, jobs] of [...groups].sort((a, b) => b[0].localeCompare(a[0]))) {
                const group = document.createElement('details');
                const summary = document.createElement('summary');
                const master = document.createElement('input');
                master.type = 'checkbox'; master.dataset.day = day;
                master.setAttribute('aria-label', t('downloadDay', { day, count: jobs.length }));
                master.onclick = event => event.stopPropagation();
                master.onchange = () => {
                    if (downloadState.busy || isRunning) return;
                    resetDownloadQueue('downloadQueueInvalid');
                    for (const job of jobs) master.checked ? downloadState.selected.add(job.key) : downloadState.selected.delete(job.key);
                    renderDownloadSection();
                };
                summary.append(master, document.createTextNode(' ' + t('downloadDay', { day, count: jobs.length })));
                group.appendChild(summary);
                for (const job of jobs) {
                    const label = document.createElement('label');
                    Object.assign(label.style, { display: 'flex', gap: '6px', alignItems: 'start', padding: '5px 2px', overflowWrap: 'anywhere' });
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox'; checkbox.dataset.jobKey = job.key;
                    checkbox.onchange = () => {
                        if (downloadState.busy || isRunning) return;
                        resetDownloadQueue('downloadQueueInvalid');
                        checkbox.checked ? downloadState.selected.add(job.key) : downloadState.selected.delete(job.key);
                        renderDownloadSection();
                    };
                    const text = document.createElement('span'); text.textContent = `${job.name} · ${job.modified}`;
                    label.append(checkbox, text); group.appendChild(label);
                }
                list.appendChild(group);
            }
            downloadState.renderedJobs = downloadState.jobs;
            downloadState.renderedList = list;
            downloadState.renderedLanguage = currentLanguage;
        }
        list?.querySelectorAll('input[data-job-key]').forEach(input => { input.checked = downloadState.selected.has(input.dataset.jobKey); });
        list?.querySelectorAll('input[data-day]').forEach(input => {
            const jobs = downloadState.jobs.filter(job => job.day === input.dataset.day);
            const count = jobs.filter(job => downloadState.selected.has(job.key)).length;
            input.checked = count === jobs.length;
            input.indeterminate = count > 0 && count < jobs.length;
        });
        updateDownloadControls();
    }

    async function scanDownloadJobs() {
        if (isRunning || downloadState.busy) return;
        const start = getUiElement('af3-download-start')?.value;
        const end = getUiElement('af3-download-end')?.value;
        resetDownloadQueue();
        downloadState.complete = false;
        downloadState.jobs = [];
        downloadState.selected.clear();
        downloadState.unknown = 0;
        if (!validDownloadDay(start) || !validDownloadDay(end) || start > end) {
            setDownloadMessage('downloadInvalidRange'); return;
        }
        downloadState.busy = true;
        downloadState.stop = false;
        downloadState.phase = 'scan';
        downloadState.selectionChanged = false;
        checkSystemStatus();
        try {
            getDownloadHistory();
            downloadState.context = getDownloadContext();
            downloadState.scanContext = downloadState.context;
            const visited = new Set(), identities = new Map(), matches = [];
            let page = await firstDownloadPage();
            while (true) {
                checkDownloadActive();
                if (visited.has(page.signature) || visited.size >= 1000) throw new Error(t('downloadPageError'));
                visited.add(page.signature);
                for (const job of page.jobs) {
                    if (identities.has(job.key)) {
                        throw new Error(t(job.id ? 'downloadPageError' : 'downloadAmbiguous'));
                    }
                    identities.set(job.key, job);
                    if (!job.day) { downloadState.unknown++; continue; }
                    if (job.day >= start && job.day <= end) {
                        const { row, ...record } = job;
                        matches.push(record);
                    }
                }
                setDownloadMessage('downloadScanning', { page: visited.size, count: matches.length });
                if (!downloadButtonEnabled(page.next)) break;
                page = await moveDownloadPage(page.next, page.signature);
            }
            await firstDownloadPage();
            checkDownloadActive();
            downloadState.jobs = matches;
            downloadState.selected = new Set(matches.map(job => job.key));
            downloadState.complete = true;
            setDownloadMessage('downloadFound');
        } catch (error) {
            setDownloadMessage(isUserStopError(error) ? 'downloadIncomplete' : 'error', { detail: error.message });
        } finally {
            downloadState.busy = false;
            renderDownloadSection();
            checkSystemStatus();
        }
    }

    async function applySelectionToWebsite(advance = false) {
        if (isRunning || downloadState.busy) return;
        if (!downloadState.complete || !downloadState.selected.size) { setDownloadMessage('downloadNoSelection'); return; }
        const individual = downloadState.format === 'individual';
        const previousQueue = downloadState.queue;
        if (advance && (!individual || !previousQueue || previousQueue.index >= previousQueue.records.length - 1)) return;
        downloadState.stop = false;
        downloadState.selectionChanged = false;
        downloadState.context = downloadState.scanContext;
        let records, queueRecords, queueIndex;
        try {
            checkDownloadActive();
            queueRecords = advance ? previousQueue.records : downloadState.jobs.filter(job => downloadState.selected.has(job.key));
            if (queueRecords.length !== downloadState.selected.size) throw new Error(t('downloadNativeMismatch'));
            if (advance && previousQueue.context !== getDownloadContext()) throw new Error(t('downloadContextChanged'));
            if (!advance && !confirm(t(individual ? 'downloadIndividualConfirm' : 'downloadApplyConfirm', { count: queueRecords.length }))) return;
            checkDownloadActive();
            queueIndex = advance ? previousQueue.index + 1 : 0;
            records = individual ? [queueRecords[queueIndex]] : queueRecords;
        } catch (error) {
            resetDownloadQueue();
            downloadState.complete = false;
            setDownloadMessage('error', { detail: error.message }); return;
        }
        downloadState.busy = true;
        downloadState.phase = 'apply';
        downloadState.watchNative = true;
        checkSystemStatus();
        renderDownloadSection();
        try {
            if (advance) {
                // Verify the previous selection before replacing it. A count of
                // one alone cannot establish which job the user has selected.
                const current = await collectNativeDownloadSelection();
                if (current.length !== 1 || !sameDownloadJob(current[0], previousQueue.records[previousQueue.index])) throw new Error(t('downloadNativeMismatch'));
            }
            await applyNativeDownloadSelection(records);
            const verified = await collectNativeDownloadSelection();
            const targets = new Map(records.map(job => [job.key, job]));
            if (verified.length !== records.length || verified.some(job => !sameDownloadJob(job, targets.get(job.key)))) throw new Error(t('downloadNativeMismatch'));
            checkDownloadActive();
            // Advance only after exact website selection verification. This is
            // selection progress and does not imply a file has been downloaded.
            downloadState.queue = individual ? {
                records: advance ? queueRecords : Object.freeze(queueRecords.map(job => Object.freeze({ ...job }))),
                index: queueIndex, context: downloadState.context,
            } : null;
            setDownloadMessage(individual ? 'downloadIndividualApplied' : records.length > 50 ? 'downloadAppliedLimit' : 'downloadApplied', { count: records.length });
        } catch (error) {
            resetDownloadQueue();
            if (!isUserStopError(error)) downloadState.complete = false;
            setDownloadMessage(isUserStopError(error) ? 'downloadStopped' : 'downloadError', { detail: error.message });
        } finally {
            downloadState.busy = false;
            downloadState.watchNative = false;
            renderDownloadSection();
            checkSystemStatus();
        }
    }

    function createDownloadSection() {
        const section = document.createElement('details');
        section.id = 'af3-download-section';
        Object.assign(section.style, { borderTop: '1px solid #555', paddingTop: '8px', flexShrink: '0', fontSize: '14px', lineHeight: '1.5', overflowWrap: 'anywhere' });
        const translated = (tag, key) => {
            const node = document.createElement(tag); node.dataset.downloadI18n = key; node.textContent = t(key); return node;
        };
        const summary = translated('summary', 'downloadTitle');
        Object.assign(summary.style, { cursor: 'pointer', color: '#8ab4f8', fontWeight: 'bold' });
        section.appendChild(summary);
        const ready = document.createElement('div');
        Object.assign(ready.style, { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px' });
        const light = document.createElement('span'); light.id = 'af3-download-ready-light';
        Object.assign(light.style, { width: '8px', height: '8px', borderRadius: '50%', flexShrink: '0' });
        const readyText = document.createElement('span'); readyText.id = 'af3-download-ready-text'; readyText.setAttribute('role', 'status');
        ready.append(light, readyText); section.appendChild(ready);
        section.appendChild(translated('p', 'downloadNote'));
        const dates = document.createElement('div');
        Object.assign(dates.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' });
        const today = new Date();
        const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        for (const [id, key] of [['start', 'downloadStart'], ['end', 'downloadEnd']]) {
            const label = document.createElement('label'); label.appendChild(translated('span', key));
            const input = document.createElement('input'); input.type = 'date'; input.id = `af3-download-${id}`; input.value = day;
            Object.assign(input.style, { display: 'block', boxSizing: 'border-box', width: '100%', minWidth: '0', padding: '6px 2px', border: '1px solid #666', borderRadius: '4px', background: '#303134', color: '#fff', fontSize: '14px', colorScheme: 'dark' });
            input.onchange = () => {
                resetDownloadQueue();
                downloadState.complete = false; downloadState.jobs = []; downloadState.selected.clear(); setDownloadMessage('downloadIdle');
            };
            label.appendChild(input); dates.appendChild(label);
        }
        section.appendChild(dates);
        const formatLabel = document.createElement('label');
        Object.assign(formatLabel.style, { display: 'block', marginTop: '8px' });
        formatLabel.appendChild(translated('span', 'downloadFormat'));
        const format = document.createElement('select');
        format.id = 'af3-download-format';
        for (const [value, key] of [['combined', 'downloadCombined'], ['individual', 'downloadIndividual']]) {
            const option = translated('option', key); option.value = value; format.appendChild(option);
        }
        format.value = downloadState.format;
        Object.assign(format.style, { display: 'block', boxSizing: 'border-box', width: '100%', minWidth: '0', padding: '6px 4px', border: '1px solid #666', borderRadius: '4px', background: '#303134', color: '#fff', fontSize: '14px' });
        format.onchange = () => {
            downloadState.format = format.value === 'individual' ? 'individual' : 'combined';
            try { localStorage.setItem(DOWNLOAD_FORMAT_KEY, downloadState.format); } catch (_) {}
            resetDownloadQueue('downloadQueueInvalid');
            renderDownloadSection();
        };
        formatLabel.appendChild(format); section.appendChild(formatLabel);
        const actions = document.createElement('div');
        Object.assign(actions.style, { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' });
        for (const [id, key, action] of [
            ['scan', 'downloadScan', scanDownloadJobs],
            ['all', 'downloadAll', () => { if (downloadState.busy || isRunning) return; resetDownloadQueue(); downloadState.selected = new Set(downloadState.jobs.map(job => job.key)); setDownloadMessage('downloadFound'); }],
            ['clear', 'downloadClear', () => { if (downloadState.busy || isRunning) return; resetDownloadQueue(); downloadState.selected.clear(); setDownloadMessage('downloadFound'); }],
            ['apply', 'downloadApply', () => applySelectionToWebsite()],
            ['next', 'downloadNext', () => applySelectionToWebsite(true)],
            ['stop', 'stopButton', () => { downloadState.stop = true; updateDownloadControls(); }],
        ]) {
            const button = translated('button', key); button.type = 'button'; button.id = `af3-download-${id}`;
            stylePanelButton(button, id === 'stop' ? '#b3261e' : id === 'apply' ? '#137333' : '#3c4043');
            button.onclick = action; actions.appendChild(button);
        }
        section.appendChild(actions);
        const status = document.createElement('p'); status.id = 'af3-download-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        Object.assign(status.style, { overflowWrap: 'anywhere', color: '#dfe1e5', margin: '8px 0' }); section.appendChild(status);
        const queue = document.createElement('p'); queue.id = 'af3-download-queue'; queue.setAttribute('role', 'status'); queue.setAttribute('aria-live', 'polite');
        Object.assign(queue.style, { overflowWrap: 'anywhere', color: '#8ab4f8', margin: '8px 0' }); section.appendChild(queue);
        const list = document.createElement('div'); list.id = 'af3-download-results';
        Object.assign(list.style, { maxHeight: '240px', overflow: 'auto' }); section.appendChild(list);
        const hint = translated('p', 'downloadHint'); hint.style.color = '#bdc1c6'; section.appendChild(hint);
        return section;
    }

    // --- UI 拖拽 ---
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = handle || element.querySelector('#af3-header');
        if (!header) return;
        header.onmousedown = dragMouseDown;
        function dragMouseDown(e) {
            e = e || window.event; e.preventDefault();
            const currentLeft = element.offsetLeft;
            const currentTop = element.offsetTop;
            element.style.left = currentLeft + "px";
            element.style.top = currentTop + "px";
            element.style.right = "auto";
            pos3 = e.clientX; pos4 = e.clientY;
            isDraggingPanel = true;
            document.onmouseup = closeDragElement; document.onmousemove = elementDrag;
            element.style.cursor = 'grabbing';
        }
        function elementDrag(e) {
            e = e || window.event; e.preventDefault();
            pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
            pos3 = e.clientX; pos4 = e.clientY;
            element.style.top = Math.min(Math.max(12, element.offsetTop - pos2),
                Math.max(12, window.innerHeight - element.offsetHeight - 12)) + 'px';
            element.style.left = Math.min(Math.max(12, element.offsetLeft - pos1),
                Math.max(12, window.innerWidth - element.offsetWidth - 12)) + 'px';
        }
        function closeDragElement() {
            document.onmouseup = null; document.onmousemove = null;
            savePanelPosition(element);
            isDraggingPanel = false;
            element.style.cursor = 'default';
        }
    }

    function makeResizable(host, handle) {
        const resize = (width, height) => {
            const rect = host.getBoundingClientRect();
            const size = clampPanelSize({ width, height });
            host.style.width = Math.min(size.width, Math.max(1, window.innerWidth - rect.left - 12)) + 'px';
            host.style.height = Math.min(size.height, Math.max(1, window.innerHeight - rect.top - 12)) + 'px';
        };
        handle.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            const rect = host.getBoundingClientRect();
            const startX = event.clientX, startY = event.clientY;
            isResizingPanel = true;
            try { handle.setPointerCapture(event.pointerId); } catch (e) { /* Synthetic or lost pointer. */ }
            const move = moveEvent => {
                if (moveEvent.pointerId !== event.pointerId) return;
                resize(rect.width + moveEvent.clientX - startX, rect.height + moveEvent.clientY - startY);
            };
            const end = endEvent => {
                if (endEvent.pointerId !== event.pointerId) return;
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', end);
                document.removeEventListener('pointercancel', end);
                try { handle.releasePointerCapture(event.pointerId); } catch (e) { /* Pointer already released. */ }
                savePanelSize(host);
                isResizingPanel = false;
                applyHostStyle(host);
            };
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', end);
            document.addEventListener('pointercancel', end);
        });
        handle.addEventListener('keydown', event => {
            const delta = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key];
            if (!delta) return;
            event.preventDefault();
            const rect = host.getBoundingClientRect();
            const size = clampPanelSize({ width: rect.width + delta[0], height: rect.height + delta[1] });
            host.style.width = size.width + 'px';
            host.style.height = size.height + 'px';
            savePanelSize(host);
            applyHostStyle(host);
        });
    }

    function stylePanelButton(button, backgroundColor, color = '#fff') {
        Object.assign(button.style, {
            padding: '7px 8px',
            backgroundColor,
            color,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            transition: 'all 0.2s'
        });
    }

    // --- UI ---
    function ensureUI() {
        if (!document.documentElement || !document.body) return;

        let host = getPanelHost();
        if (host?.shadowRoot?.getElementById(PANEL_ROOT_ID)) {
            applyHostStyle(host);
            return;
        }

        if (host) host.remove();

        host = document.createElement('div');
        host.id = CONTAINER_ID;
        host.setAttribute('data-af3-auto-submitter', 'true');
        applyHostStyle(host);

        const shadow = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        container.id = PANEL_ROOT_ID;
        Object.assign(container.style, {
            all: 'initial',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '100%',
            height: '100%',
            minHeight: '0',
            overflow: 'auto',
            padding: '15px 15px 30px',
            backgroundColor: 'rgba(32, 33, 36, 0.97)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            border: '1px solid #5f6368',
            fontFamily: 'Roboto, Arial, sans-serif',
            fontSize: '14px',
            color: '#fff',
            lineHeight: 'normal'
        });

        const header = document.createElement('div');
        header.id = 'af3-header';
        Object.assign(header.style, {
            textAlign: 'center', cursor: 'move', paddingBottom: '8px',
            borderBottom: '1px solid #444', fontWeight: 'bold', color: '#eee', fontSize: '16px', overflowWrap: 'anywhere'
        });
        header.textContent = `${t('headerDev')} ${SCRIPT_VERSION}`;

        const languageRow = document.createElement('div');
        Object.assign(languageRow.style, {
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '-4px',
            marginBottom: '-2px'
        });
        const languageSelect = document.createElement('select');
        languageSelect.id = 'af3-language-select';
        languageSelect.title = t('languageTitle');
        LANGUAGES.forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            languageSelect.appendChild(option);
        });
        languageSelect.value = currentLanguage;
        Object.assign(languageSelect.style, {
            width: '108px',
            padding: '2px 4px',
            borderRadius: '4px',
            border: '1px solid #3c4043',
            backgroundColor: '#2b2c30',
            color: '#cfd2d6',
            fontSize: '13px',
            outline: 'none'
        });
        languageSelect.onchange = () => {
            currentLanguage = I18N[languageSelect.value] ? languageSelect.value : 'zh';
            saveLanguage(currentLanguage);
            applyLanguage();
        };
        languageRow.appendChild(languageSelect);

        const statusRow = document.createElement('div');
        Object.assign(statusRow.style, { display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' });
        const statusLight = document.createElement('div');
        statusLight.id = 'af3-status-light';
        Object.assign(statusLight.style, {
            width: '10px', height: '10px', borderRadius: '50%',
            backgroundColor: '#f44336', flexShrink: '0', transition: 'all 0.3s'
        });
        const statusText = document.createElement('span');
        statusText.id = 'af3-status-text';
        statusText.textContent = t('initializing');
        Object.assign(statusText.style, { fontSize: '14px', color: '#bbb', minWidth: '0', overflowWrap: 'anywhere', lineHeight: '1.5' });
        statusRow.appendChild(statusLight); statusRow.appendChild(statusText);

        const quota = document.createElement('p');
        quota.id = 'af3-quota';
        quota.setAttribute('role', 'status');
        quota.setAttribute('aria-live', 'polite');
        Object.assign(quota.style, {
            margin: '0', fontSize: '14px', color: '#dfe1e5',
            overflowWrap: 'anywhere', lineHeight: '1.5', flexShrink: '0'
        });
        quota.textContent = t('quotaUnknown');

        const controls = document.createElement('div');
        Object.assign(controls.style, { display: 'flex', alignItems: 'center', gap: '8px' });
        const input = document.createElement('input');
        input.type = 'number'; input.value = '10'; input.id = 'af3-v20-count';
        Object.assign(input.style, {
            width: '50px', padding: '8px', borderRadius: '6px', border: '1px solid #555',
            textAlign: 'center', fontWeight: 'bold', backgroundColor: '#333', color: '#fff', fontSize: '14px'
        });
        const btn = document.createElement('button');
        btn.id = 'af3-v20-btn'; btn.textContent = t('startButton');
        Object.assign(btn.style, {
            flex: '1', padding: '8px', backgroundColor: '#666', color: '#aaa',
            border: 'none', borderRadius: '6px', cursor: 'not-allowed',
            fontWeight: 'bold', fontSize: '16px', transition: 'all 0.3s'
        });
        btn.disabled = true; btn.onclick = mainProcess;
        controls.appendChild(input); controls.appendChild(btn);

        const runControls = document.createElement('div');
        runControls.id = 'af3-run-controls';
        Object.assign(runControls.style, { display: 'none', gap: '8px' });

        const pauseBtn = document.createElement('button');
        pauseBtn.id = 'af3-pause-btn';
        pauseBtn.textContent = t('pauseButton');
        stylePanelButton(pauseBtn, '#5f6368');
        pauseBtn.onclick = togglePause;

        const stopBtn = document.createElement('button');
        stopBtn.id = 'af3-stop-btn';
        stopBtn.textContent = t('stopButton');
        stylePanelButton(stopBtn, '#d93025');
        stopBtn.onclick = requestStop;

        runControls.appendChild(pauseBtn);
        runControls.appendChild(stopBtn);

        const footer = document.createElement('div');
        footer.id = 'af3-footer-msg';
        footer.textContent = t('devFooter');
        Object.assign(footer.style, {
            fontSize: '13px', color: '#fdd835', textAlign: 'center', marginTop: '4px', overflowWrap: 'anywhere'
        });

        const logPanel = document.createElement('div');
        Object.assign(logPanel.style, { borderTop: '1px solid #444', paddingTop: '6px' });

        const logToggle = document.createElement('button');
        logToggle.id = 'af3-log-toggle';
        logToggle.type = 'button';
        logToggle.textContent = `▶ ${t('logLabel')} (0)`;
        Object.assign(logToggle.style, {
            width: '100%',
            padding: '4px 0',
            background: 'transparent',
            border: 'none',
            color: '#9aa0a6',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
        });
        logToggle.onclick = toggleLogPanel;

        const logBody = document.createElement('pre');
        logBody.id = 'af3-log-body';
        Object.assign(logBody.style, {
            display: 'none',
            maxHeight: '120px',
            overflow: 'auto',
            margin: '6px 0 0',
            padding: '8px',
            backgroundColor: 'rgba(0,0,0,0.25)',
            border: '1px solid #3c4043',
            borderRadius: '6px',
            color: '#dfe1e5',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            minHeight: '60px',
            fontFamily: 'Consolas, monospace',
            fontSize: '13px',
            lineHeight: '1.35'
        });
        logPanel.appendChild(logToggle);
        logPanel.appendChild(logBody);

        container.appendChild(header); container.appendChild(languageRow); container.appendChild(statusRow);
        container.appendChild(quota);
        container.appendChild(controls); container.appendChild(runControls);
        container.appendChild(createDownloadSection());
        container.appendChild(footer); container.appendChild(logPanel);
        shadow.appendChild(container);
        const resizeHandle = document.createElement('span');
        resizeHandle.id = 'af3-resize-handle';
        resizeHandle.setAttribute('role', 'button');
        resizeHandle.tabIndex = 0;
        resizeHandle.textContent = '↘';
        resizeHandle.title = t('resizePanel');
        resizeHandle.setAttribute('aria-label', t('resizePanel'));
        Object.assign(resizeHandle.style, {
            position: 'absolute', right: '5px', bottom: '5px', width: '22px', height: '22px',
            display: 'grid', placeItems: 'center', fontSize: '18px', borderRadius: '4px',
            backgroundColor: '#3c4043', color: '#fff', cursor: 'nwse-resize',
            userSelect: 'none', touchAction: 'none', zIndex: '1'
        });
        shadow.appendChild(resizeHandle);
        document.body.appendChild(host);
        makeDraggable(host, header);
        makeResizable(host, resizeHandle);
        renderLogPanel();
        updateRunControls();
        applyLanguage();
    }

    // --- 状态检测 & 模式判断 ---
    let currentMode = 'NONE';

    function checkSystemStatus() {
        updateQuota();
        updateDownloadControls();
        const btn = getUiElement('af3-v20-btn');
        const light = getUiElement('af3-status-light');
        const text = getUiElement('af3-status-text');
        const footer = getUiElement('af3-footer-msg');

        if (!btn || !light || !text || isRunning) return;

        if (downloadState.busy) {
            btn.disabled = true;
            btn.style.cursor = 'not-allowed';
            const state = downloadReadiness();
            text.textContent = t(state.key); text.style.color = state.color;
            light.style.backgroundColor = state.color;
            light.style.boxShadow = `0 0 8px ${state.color}`;
            return;
        }

        if (submissionBlockReason) {
            btn.disabled = true;
            btn.textContent = t('submissionLocked');
            btn.style.cursor = 'not-allowed';
            light.style.backgroundColor = '#f44336';
            light.style.boxShadow = '0 0 8px #f44336';
            text.textContent = t('submissionLocked');
            text.style.color = '#ef5350';
            footer.textContent = submissionBlockReason;
            return;
        }

        const selected = getSelectedHistoryStatuses();
        const status = selected.length === 1 ? selected[0] : '';

        try {
            getDownloadContext();
            currentMode = 'NONE';
            const state = { key: 'downloadReadyApply', color: '#81c995' };
            text.textContent = t(state.key, state.vars); text.style.color = state.color;
            light.style.backgroundColor = state.color; light.style.boxShadow = `0 0 8px ${state.color}`;
            footer.textContent = t('downloadReadyFooter');
            btn.disabled = true; btn.style.backgroundColor = '#444'; btn.style.color = '#888'; btn.style.cursor = 'not-allowed';
            return;
        } catch (_) {}

        if (status === 'saved draft') {
            currentMode = 'DRAFT';
            light.style.backgroundColor = '#00e676'; // Green
            light.style.boxShadow = '0 0 8px #00e676';
            text.textContent = t('readyDraftStatus'); text.style.color = '#00e676';
            footer.textContent = t('modeDraftFooter');
            btn.disabled = false; btn.style.backgroundColor = '#1a73e8'; btn.style.color = 'white'; btn.style.cursor = 'pointer';
        } else if (status === 'failed') {
            currentMode = 'FAILED';
            light.style.backgroundColor = '#2979ff'; // Blue
            light.style.boxShadow = '0 0 8px #2979ff';
            text.textContent = t('readyFailedStatus'); text.style.color = '#2979ff';
            footer.textContent = t('modeFailedFooter');
            btn.disabled = false; btn.style.backgroundColor = '#1565c0'; btn.style.color = 'white'; btn.style.cursor = 'pointer';
        } else {
            currentMode = 'NONE';
            light.style.backgroundColor = '#f44336'; // Red
            light.style.boxShadow = '0 0 8px #f44336';
            text.textContent = t('standbyStatus'); text.style.color = '#ef5350';
            footer.textContent = t('standbyFooter');
            btn.disabled = true; btn.style.backgroundColor = '#444'; btn.style.color = '#888'; btn.style.cursor = 'not-allowed';
        }
    }

    // --- 主入口 ---
    async function mainProcess() {
        if (isRunning || downloadState.busy || submissionBlockReason) return;
        checkSystemStatus();
        const mode = currentMode;
        if (mode !== 'DRAFT' && mode !== 'FAILED') return;

        const countInput = getUiElement('af3-v20-count');
        const requestedJobs = parseInt(countInput.value, 10) || 10;
        const maxJobs = confirmStart(requestedJobs);
        if (!maxJobs) return;
        checkSystemStatus();
        if (currentMode !== mode) return;

        if (mode === 'DRAFT') {
            await runDraftSubmission(maxJobs);
        } else if (mode === 'FAILED') {
            await runFailedReprocessing(maxJobs);
        }
    }

    // --- 模式 A: 草稿提交 ---
    async function runDraftSubmission(maxJobs) {
        startRunProgress(maxJobs);
        setRunningState(true);
        let finalStatus = 'completed';
        let finalMessage = '';
        try {
            for (let i = 1; i <= maxJobs; i++) {
                await waitIfPaused();
                setProgressCurrent(i);
                updateBtnText(`${i} / ${maxJobs}`);
                const rows = getRows();
                addLog(t('draftProgress', { current: i, total: maxJobs, rows: rows.length }));
                if (rows.length === 0) {
                    finalMessage = t('listEmptyDetail');
                    addLog(t('listEmptyLog'), 'warn');
                    break;
                }
                const taskLabel = getTaskLabel(rows[0], `Draft ${i}`);
                const draftIdentity = getDraftIdentity(rows[0]);

                simulateClick(rows[0], 'rgba(0,0,255,0.2)');
                await controlledSleep(500);

                const continueBtn = findButtonByText("Continue and preview job");
                if (continueBtn) {
                    addLog(t('foundContinue'));
                    simulateClick(continueBtn, 'rgba(0,255,0,0.3)');
                    await controlledSleep(WAIT_FOR_MODAL);
                } else {
                    const reason = t('missingContinue');
                    addLog(reason, 'warn');
                    recordProgressResult('skipped', { label: taskLabel, reason });
                    continue;
                }

                let confirmBtn = findButtonByText("Confirm and submit");
                if (!confirmBtn) {
                     if (document.body.innerText.includes("Daily quota")) throw new Error(t('quotaFull'));
                     const reason = t('missingConfirm');
                     addLog(reason, 'warn');
                     recordProgressResult('skipped', { label: taskLabel, reason });
                     continue;
                }
                addLog(t('foundConfirm'));
                await submitAndConfirm(confirmBtn);
                addLog(t('draftDone', { index: i }));
                recordProgressResult('success');
                await waitForDraftRemoval(draftIdentity);
            }
        } catch (e) {
            finalStatus = isUserStopError(e) ? 'stopped' : 'error';
            finalMessage = e.message;
            if (finalStatus !== 'stopped') recordProgressResult('error', {
                label: getModeLabel(),
                reason: e.message
            });
            addLog(t('draftStopped', { message: e.message }), isUserStopError(e) ? 'warn' : 'error');
        } finally {
            setRunningState(false);
            finishRunProgress(finalStatus, finalMessage);
        }
    }

    // --- 模式 B: 失败重跑 (修复版) ---
    async function runFailedReprocessing(maxJobs) {
        startRunProgress(maxJobs);
        setRunningState(true);
        let finalStatus = 'completed';
        let finalMessage = '';
        try {
            for (let i = 0; i < maxJobs; i++) {
                await waitIfPaused();
                setProgressCurrent(i + 1);
                updateBtnText(`Job ${i + 1} / ${maxJobs}`);
                addLog(t('failedProgress', { current: i + 1, total: maxJobs }));

                // 1. 确保在 Failed 页面
                await backToFailedTab();
                await controlledSleep(1500);

                const rows = getRows();
                if (i >= rows.length) {
                    finalMessage = t('failedAllDoneDetail');
                    addLog(t('failedAllDoneLog'));
                    break;
                }
                const targetRow = rows[i];
                const taskLabel = getTaskLabel(targetRow, `Failed job ${i + 1}`);
                targetRow.scrollIntoView({behavior: "auto", block: "center"});

                // 2. 点击菜单 (3个点)
                const menuClicked = await clickMenuOnRow(targetRow);
                if (!menuClicked) {
                    const reason = t('missingMenu', { index: i + 1 });
                    addLog(reason, 'warn');
                    recordProgressResult('skipped', { label: taskLabel, reason });
                    continue;
                }
                // 等待菜单弹出，这里多给一点时间
                await controlledSleep(800);

                // 3. 【核心修复】点击 Clone
                const cloneClicked = await clickCloneOption();
                if (!cloneClicked) {
                    const reason = t('missingClone', { index: i + 1 });
                    addLog(reason, 'warn');
                    recordProgressResult('skipped', { label: taskLabel, reason });
                    // 点击 body 关闭可能已打开的菜单
                    document.body.click();
                    await controlledSleep(500);
                    continue;
                }

                // 4. 等待跳转
                updateBtnText("Cloning...");
                await controlledSleep(WAIT_FOR_PAGE_LOAD);

                // 5. 点击 Continue
                let continueBtn = null;
                for(let w=0; w<15; w++) { // 7.5秒轮询
                    await controlledSleep(500);
                    continueBtn = findButtonByText("Continue and preview job");
                    if(continueBtn) break;
                }

                if (!continueBtn) {
                    const reason = t('missingCloneContinue');
                    addLog(reason, 'warn');
                    recordProgressResult('skipped', { label: taskLabel, reason });
                    continue;
                }
                addLog(t('foundContinue'));
                simulateClick(continueBtn);
                await controlledSleep(WAIT_FOR_MODAL);

                // 6. 点击 Confirm
                let confirmBtn = findButtonByText("Confirm and submit");
                if (!confirmBtn) {
                     if (document.body.innerText.includes("Daily quota")) throw new Error(t('quotaFull'));
                     if (continueBtn) simulateClick(continueBtn); // 再次尝试点击continue
                     await controlledSleep(1000);
                     confirmBtn = findButtonByText("Confirm and submit");
                     if (!confirmBtn) throw new Error(t('missingConfirmError'));
                }
                addLog(t('foundConfirm'));
                await submitAndConfirm(confirmBtn);
                addLog(t('failedSubmitted', { index: i + 1 }));
                recordProgressResult('success');
                await controlledSleep(2500);
            }

        } catch (e) {
            finalStatus = isUserStopError(e) ? 'stopped' : 'error';
            finalMessage = e.message;
            if (finalStatus !== 'stopped') recordProgressResult('error', {
                label: getModeLabel(),
                reason: e.message
            });
            addLog(t('failedStopped', { message: e.message }), isUserStopError(e) ? 'warn' : 'error');
        } finally {
            setRunningState(false);
            finishRunProgress(finalStatus, finalMessage);
        }
    }

    // --- 辅助状态管理 ---
    function setRunningState(state) {
        isRunning = state;
        shouldStop = false;
        isPaused = false;
        const btn = getUiElement('af3-v20-btn');
        const input = getUiElement('af3-v20-count');
        if (btn) {
            if (!state) {
                btn.textContent = t('startButton');
                btn.disabled = Boolean(submissionBlockReason);
                if (input) input.disabled = false;
                checkSystemStatus();
            } else {
                btn.disabled = true;
                if (input) input.disabled = true;
                updateBtnText(t('runningButton'));
            }
        }
        updateRunControls();
        addLog(state ? t('runStarted') : t('runEnded'));
    }

    function updateRunControls() {
        const runControls = getUiElement('af3-run-controls');
        const pauseBtn = getUiElement('af3-pause-btn');
        const stopBtn = getUiElement('af3-stop-btn');

        if (runControls) runControls.style.display = isRunning ? 'flex' : 'none';
        if (pauseBtn) {
            pauseBtn.textContent = isPaused ? t('resumeButton') : t('pauseButton');
            pauseBtn.style.backgroundColor = isPaused ? '#188038' : '#5f6368';
            pauseBtn.disabled = !isRunning || shouldStop;
            pauseBtn.style.opacity = pauseBtn.disabled ? '0.6' : '1';
        }
        if (stopBtn) {
            stopBtn.disabled = !isRunning || shouldStop;
            stopBtn.style.opacity = stopBtn.disabled ? '0.6' : '1';
            stopBtn.style.cursor = stopBtn.disabled ? 'not-allowed' : 'pointer';
        }
    }

    function updateBtnText(text) {
        const btn = getUiElement('af3-v20-btn');
        if (btn) btn.textContent = text;
    }

    function boot() {
        ensureUI();

        setInterval(ensureUI, 1000);
        setInterval(checkSystemStatus, 500);

        const observer = new MutationObserver(() => {
            if (!getPanelHost()) ensureUI();
            updateQuota();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

        window.addEventListener('resize', () => applyHostStyle(getPanelHost()));
        window.addEventListener('pageshow', ensureUI);
        document.addEventListener('visibilitychange', ensureUI);
    }

    function bootWhenReady() {
        if (document.documentElement && document.body) {
            boot();
        } else {
            setTimeout(bootWhenReady, 50);
        }
    }

    bootWhenReady();
})();
