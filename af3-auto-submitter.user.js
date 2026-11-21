// ==UserScript==
// @name         AF3 Auto Submitter (huaaaajjj)
// @namespace    https://github.com/huaaaajjj/af3-auto-submitter
// @version      5.0.3
// @description  正式版：FASTA 分批保存与草稿导入、提交确认、按日期下载、结果 ZIP 保存及本地指标 CSV 提取汇总。
// @author       Jiang Siyuan; huaaaajjj
// @homepageURL  https://github.com/huaaaajjj/af3-auto-submitter
// @supportURL   https://github.com/huaaaajjj/af3-auto-submitter/issues
// @match        https://alphafoldserver.com/*
// @match        https://www.alphafoldserver.com/*
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @sandbox      raw
// @run-at       document-start
// @noframes
// @updateURL    https://raw.githubusercontent.com/huaaaajjj/af3-auto-submitter/main/af3-auto-submitter.meta.js
// @downloadURL  https://raw.githubusercontent.com/huaaaajjj/af3-auto-submitter/main/af3-auto-submitter.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置 ---
    const SCRIPT_VERSION = '5.0.3';
    // ponytail: keep v3 storage/DOM identifiers for upgrades; public releases use main.
    const CONTAINER_ID = 'af3-dev-panel';
    const PANEL_ROOT_ID = 'af3-dev-panel-root';
    const PANEL_POSITION_KEY = `${CONTAINER_ID}-position`;
    const PANEL_SIZE_KEY = `${CONTAINER_ID}-size`;
    const LANGUAGE_KEY = `${CONTAINER_ID}-language`;
    const DOWNLOAD_FORMAT_KEY = `${CONTAINER_ID}-download-format`;
    const ACCOUNTS_KEY = `${CONTAINER_ID}-accounts-v1`;
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
            accountEmail: '当前账号：{email}',
            accountUnknown: '当前账号：未识别，请检查登录状态。',
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
            headerTitle: 'AF3 自动助手',
            headerProd: '🤖 AF3 自动助手',
            languageTitle: '界面语言',
            batchCount: '本次数量',
            initializing: '初始化...',
            startButton: '启动',
            runningButton: '运行中...',
            pausedButton: '已暂停',
            stoppingButton: '停止中...',
            pauseButton: '暂停',
            resumeButton: '继续',
            stopButton: '停止',
            logLabel: '日志',
            releaseHint: '请仅启用一份脚本，提交前核对账号与额度',
            modeDraftFooter: '模式: 批量提交 Saved Drafts',
            modeFailedFooter: '模式: Clone & Resubmit',
            standbyFooter: '请在官网 History 中仅选 Saved draft 或 Failed。',
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
            confirmRows: '当前页识别任务行：{count}',
            confirmPlan: '本次处理上限：{count}',
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
            accountEmail: 'Current account: {email}',
            accountUnknown: 'Current account: unavailable. Check sign-in.',
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
            headerTitle: 'AF3 Auto Submitter',
            headerProd: '🤖 AF3 Auto Submitter',
            languageTitle: 'Language',
            batchCount: 'Jobs this run',
            initializing: 'Initializing...',
            startButton: 'Start',
            runningButton: 'Running...',
            pausedButton: 'Paused',
            stoppingButton: 'Stopping...',
            pauseButton: 'Pause',
            resumeButton: 'Resume',
            stopButton: 'Stop',
            logLabel: 'Log',
            releaseHint: 'Enable only one script; check the account and quota before submitting',
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
            confirmRows: 'Rows on current page: {count}',
            confirmPlan: 'Batch limit: {count}',
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
            accountEmail: '現在のアカウント：{email}',
            accountUnknown: '現在のアカウント：取得できません。ログインを確認してください。',
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
            headerTitle: 'AF3 自動送信',
            headerProd: '🤖 AF3 自動送信',
            languageTitle: '言語',
            batchCount: '今回の件数',
            initializing: '初期化中...',
            startButton: '開始',
            runningButton: '実行中...',
            pausedButton: '一時停止中',
            stoppingButton: '停止中...',
            pauseButton: '一時停止',
            resumeButton: '再開',
            stopButton: '停止',
            logLabel: 'ログ',
            releaseHint: 'スクリプトは一つだけ有効にし、送信前にアカウントと上限を確認してください',
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
            confirmRows: '現在のページの行数：{count}',
            confirmPlan: '今回の処理上限：{count}',
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
            accountEmail: '현재 계정: {email}',
            accountUnknown: '현재 계정: 확인할 수 없습니다. 로그인을 확인하세요.',
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
            headerTitle: 'AF3 자동 제출',
            headerProd: '🤖 AF3 자동 제출',
            languageTitle: '언어',
            batchCount: '처리할 작업 수',
            initializing: '초기화 중...',
            startButton: '시작',
            runningButton: '실행 중...',
            pausedButton: '일시정지됨',
            stoppingButton: '중지 중...',
            pauseButton: '일시정지',
            resumeButton: '계속',
            stopButton: '중지',
            logLabel: '로그',
            releaseHint: '스크립트 하나만 사용하고 제출 전에 계정과 한도를 확인하세요',
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
            confirmRows: '현재 페이지의 행: {count}',
            confirmPlan: '이번 처리 상한: {count}',
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
            accountEmail: 'Cuenta actual: {email}',
            accountUnknown: 'Cuenta actual: no disponible. Revisa la sesión.',
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
            headerTitle: 'AF3 Auto Submitter',
            headerProd: '🤖 AF3 Auto Submitter',
            languageTitle: 'Idioma',
            batchCount: 'Tareas por ejecutar',
            initializing: 'Inicializando...',
            startButton: 'Iniciar',
            runningButton: 'Ejecutando...',
            pausedButton: 'Pausado',
            stoppingButton: 'Deteniendo...',
            pauseButton: 'Pausa',
            resumeButton: 'Continuar',
            stopButton: 'Detener',
            logLabel: 'Registro',
            releaseHint: 'Activa un solo script y comprueba la cuenta y la cuota antes de enviar',
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
            confirmRows: 'Filas en esta página: {count}',
            confirmPlan: 'Límite del lote: {count}',
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
            accountEmail: 'Compte actuel : {email}',
            accountUnknown: 'Compte actuel : indisponible. Vérifiez la connexion.',
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
            headerTitle: 'AF3 Auto Submitter',
            headerProd: '🤖 AF3 Auto Submitter',
            languageTitle: 'Langue',
            batchCount: 'Tâches à traiter',
            initializing: 'Initialisation...',
            startButton: 'Démarrer',
            runningButton: 'En cours...',
            pausedButton: 'En pause',
            stoppingButton: 'Arrêt...',
            pauseButton: 'Pause',
            resumeButton: 'Reprendre',
            stopButton: 'Arrêter',
            logLabel: 'Journal',
            releaseHint: 'Activez un seul script et vérifiez le compte et le quota avant l’envoi',
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
            confirmRows: 'Lignes de cette page : {count}',
            confirmPlan: 'Limite du lot : {count}',
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
        submitTitle: 'Submit jobs', downloadTitle: 'Download jobs', downloadStart: 'From', downloadEnd: 'Through',
        downloadNote: 'Includes both Modified dates. Confirmed newest-first history stops after older dates; other orders scan all pages.',
        panelCollapse: 'Collapse panel', panelExpand: 'Expand panel',
        downloadScan: 'Find jobs', downloadAll: 'Select all', downloadBatch: 'Select current batch', downloadClear: 'Clear selection',
        downloadBatchStopped: 'Batch selection stopped.',
        downloadBatchOpen: 'Open the batch folder in FASTA batches first. Your selection has not changed.',
        downloadBatchEmpty: 'No jobs in these results match the opened batch by account, name and job ID. Check the dates or use “Check history / update records” to fill in missing IDs.',
        downloadIdle: 'Choose dates, find jobs, then apply your reviewed selection to the website.',
        downloadScanning: 'Scanning page {page}… {count} matches',
        downloadFound: '{count} matches; {selected} selected. Unreadable dates skipped on scanned pages: {unknown}.',
        downloadLogStart: 'Find jobs started: {start} to {end}; filters {filters}.',
        downloadLogResult: 'Find jobs finished: {count} matches; unreadable dates {unknown}.',
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
        downloadSubmissionBusy: 'Standby: submission is running', downloadRunningBatch: 'Running: selecting the current batch',
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
        historyScanSizeError: 'Could not safely set 100 items per page. Check the history paginator before scanning again.',
        downloadContextChanged: 'The history filters, search, order, or page size changed. Find jobs again.',
        downloadMenuBusy: 'A website menu or dialog is open. Close it before finding or selecting jobs.',
        downloadMenuIdentity: 'Could not safely read or close this job’s result menu. Check the website and find jobs again.',
        downloadIdentityConflict: 'The website row has conflicting job IDs. Refresh the history and find jobs again.',
        downloadAmbiguous: 'Some jobs have identical names and Modified times, but no readable unique job ID. Narrow the website search or select and download those jobs manually.',
        downloadNoSelection: 'Select at least one job from a completed scan.',
        downloadMissing: 'A selected job changed or could not be found. Selection stopped.',
        downloadIncomplete: 'Scan stopped or incomplete. Find jobs again before applying the selection.',
        downloadDay: '{day} · {count} jobs', downloadUnknown: 'Unknown date',
        downloadSave: 'Save selected ZIPs to results…', downloadRunningSave: 'Running: saving result ZIPs',
        downloadSaveHint: 'Uses the currently opened batch folder when available; otherwise choose the folder containing manifest.json. Saves separate ZIPs in results; existing filenames are skipped without verifying their contents. Only jobs already bound to this batch and account are accepted. Original batch files are not changed.',
        downloadSaveConfirm: 'Save {count} selected jobs as separate ZIPs to {folder}/results? Only this batch’s matching job IDs and account are accepted. Existing files will not be overwritten; manifest.json and input files stay unchanged.',
        downloadSaveProgress: 'Saved {saved}/{total}; skipped {skipped} existing files. Saving {name} to {folder}/results…',
        downloadSaveDone: 'Saved {saved}/{total} to {folder}/results. Skipped {skipped} existing files (contents not verified).',
        downloadSaveCancelled: 'Folder save cancelled. Saved {saved}/{total}; skipped {skipped} existing files.',
        downloadSaveError: 'Folder save stopped. Saved {saved}/{total}; skipped {skipped} existing files. {detail}',
        downloadSaveUnsupported: 'Writable folders or Web Locks are unavailable. Use supported Edge/Chrome, or download manually on the website.',
        downloadSaveFolder: 'Choose a supported batch folder containing a valid manifest.json, not its parent folder or results.',
        downloadSaveMismatch: 'A selected job is not bound to this folder and signed-in account by name and unique job ID. Open the original batch folder and check history / update records, then select only this batch’s completed jobs.',
        downloadSaveLink: 'Cannot safely read a single same-origin ZIP Download link from this job’s own result menu. Use the website Download manually; no API URL was guessed.',
        downloadSaveResponse: 'The website did not return a complete supported ZIP. Check sign-in and try the website Download manually.',
        downloadSaveTransfer: 'ZIP transfer failed, was interrupted or timed out. Already saved files are retained.',
        downloadSaveWrite: 'Could not commit a result file. Check folder permission, free space and other writers. Already saved files are retained.',
        downloadSaveCleanup: 'Could not remove the new incomplete file {name}. Remove that file manually before retrying; existing files are never overwritten.',
        downloadSaveLocked: 'Another page is saving results for this batch. Stop that save before retrying.',
        scoreExtract: 'Extract results to CSV…', scoreRunning: 'Running: extracting local ZIP scores',
        scoreHint: 'Reads every ZIP in the batch results folder locally (no website scan or download). Reuses the opened batch or asks for its folder. Exports per-ZIP best/pair CSVs and batch best/all-model/missing tables; asks before replacing generated CSVs. ZIPs and manifest stay unchanged.',
        scoreReading: 'Reading ZIP {index}/{total}: {name}…', scoreWriting: 'Saved {saved}/{total} CSV files; writing {name}…',
        scoreConfirm: 'Read {count} ZIPs, {models} model rows. Save {files} CSV files to {folder}/results? Existing generated CSVs to overwrite: {existing}.\n{names}\nSource ZIPs, input files and manifest.json will not change.',
        scoreDone: 'Saved {saved} CSV files to {folder}/results: {zips} ZIPs, {jobs} jobs, {models} models; {missing} manifest jobs without local results.',
        scoreCancelled: 'Extraction cancelled/stopped. Saved {saved} CSV files; earlier committed files are retained.',
        scoreError: 'Extraction stopped. Saved {saved} CSV files. {detail}',
        scoreInvalidZip: 'Invalid, truncated or CRC-mismatched ZIP: {name}. No scores from this archive were accepted.',
        scoreUnsupportedZip: 'Unsupported ZIP format/compression: {name}. Use ordinary single-volume, non-ZIP64 stored or deflated ZIPs.',
        scoreUnsupportedBrowser: 'This browser cannot decompress deflate-raw ZIP entries. Use a current Edge/Chrome.',
        scoreInvalidData: 'Invalid AlphaFold score JSON or dimensions: {name}. No report was written for an incomplete parse.',
        scoreLimit: 'Score extraction exceeded supported archive/JSON/CSV/row limits: {name}. Split the results into smaller batches.',
        scoreNoZips: 'No ZIP files found in results. Select the batch folder containing manifest.json and a results subfolder.',
        scoreNoModels: 'No summary_confidences model scores found in ZIP: {name}.',
        scoreAmbiguous: 'Conflicting result identities/sequences or ambiguous manifest match: {name}. No CSVs were written.',
        scoreOutputConflict: 'Derived CSV filenames conflict or are not safe filenames. No CSVs were written.',
        scoreSourceChanged: 'An input or output file changed during extraction. Stopped without overwriting the changed file.',
        scoreFileError: 'Cannot read/write files. Check results folder permissions, free space and competing writers.',
    };
    const downloadTranslations = {
        zh: {
            submitTitle: '提交任务', downloadTitle: '下载任务', downloadStart: '开始日期', downloadEnd: '结束日期',
            downloadNote: '按官网 Modified 日期，包含起止当天。确认日期倒序后越过开始日即停止；排序不确定时扫描所有分页。',
            panelCollapse: '收起面板', panelExpand: '展开面板',
            downloadScan: '查找任务', downloadAll: '全选', downloadBatch: '选择当前批次', downloadClear: '清空选择',
            downloadBatchStopped: '已停止选择当前批次。',
            downloadBatchOpen: '请先在 FASTA 区打开批次文件夹；当前勾选未改变。',
            downloadBatchEmpty: '当前查找结果中没有与已打开批次的账号、名称和任务 ID 匹配的任务。请检查日期，或先“核对官网历史 / 更新记录”补齐任务 ID。',
            downloadIdle: '先选择日期并查找任务，核对后将勾选应用到官网。',
            downloadScanning: '正在扫描第 {page} 页…已找到 {count} 个',
            downloadFound: '匹配 {count} 个，已选 {selected} 个；已扫描页面中日期无法识别、未纳入 {unknown} 个。',
            downloadLogStart: '开始查找任务：{start} 至 {end}；筛选 {filters}。',
            downloadLogResult: '查找完成：匹配 {count} 个；日期无法识别 {unknown} 个。',
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
            downloadSubmissionBusy: '待机中：正在提交任务', downloadRunningBatch: '运行中：正在选择当前批次',
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
            historyScanSizeError: '未能安全切换为每页 100 个，请检查官网分页控件后重新扫描。',
            downloadContextChanged: '官网的筛选、搜索、排序或每页数量已变化，请重新查找任务。',
            downloadMenuBusy: '官网菜单或对话框已打开，请先关闭，再查找或应用勾选。',
            downloadMenuIdentity: '未能安全读取或关闭该任务的结果菜单，已停止；请检查官网后重新查找。',
            downloadIdentityConflict: '官网任务行的唯一标识有冲突，已停止；请刷新官网历史列表后重新查找。',
            downloadAmbiguous: '有同名且 Modified 时间相同的任务，但未能读取官网唯一任务 ID。请缩小官网搜索范围，或在官网手动勾选下载。',
            downloadNoSelection: '请先完成查找，并至少勾选一个任务。',
            downloadMissing: '所选任务已变化或未找到，已停止应用。',
            downloadIncomplete: '查找已停止或未完成，请重新查找后再应用勾选。',
            downloadDay: '{day} · {count} 个', downloadUnknown: '日期无法识别',
            downloadSave: '保存所选 ZIP 到 results…', downloadRunningSave: '运行中：正在保存结果 ZIP',
            downloadSaveHint: '如果当前页面已打开有效批次文件夹，将直接沿用；否则选择含 manifest.json 的批次文件夹。在 results 中逐个保存 ZIP；已有同名文件跳过，不校验其内容。仅接受已绑定到本批次和当前账号的任务，不修改原始批次文件。',
            downloadSaveConfirm: '将所选 {count} 个任务分别保存为 ZIP 到 {folder}/results？只接受本批次与当前账号匹配的任务 ID。已有文件不覆盖，manifest.json 和输入文件不修改。',
            downloadSaveProgress: '已保存 {saved}/{total}，跳过已有文件 {skipped} 个；正在将 {name} 保存到 {folder}/results…',
            downloadSaveDone: '已保存 {saved}/{total} 到 {folder}/results；跳过已有文件 {skipped} 个（未校验内容）。',
            downloadSaveCancelled: '已取消目录保存。已保存 {saved}/{total}，跳过已有文件 {skipped} 个。',
            downloadSaveError: '目录保存已停止。已保存 {saved}/{total}，跳过已有文件 {skipped} 个。{detail}',
            downloadSaveUnsupported: '当前浏览器不支持可写目录或 Web Locks。请使用支持的 Edge/Chrome，或在官网手动下载。',
            downloadSaveFolder: '请选择含有效 manifest.json 的受支持批次文件夹，不要选父目录或 results。',
            downloadSaveMismatch: '所选任务未通过名称、唯一任务 ID 和当前账号绑定到此文件夹。请打开原批次文件夹并“核对官网历史 / 更新记录”，再仅选择本批次已完成任务。',
            downloadSaveLink: '未能从该任务自己的结果菜单中安全读取唯一、同源的 ZIP Download 链接。请在官网手动下载；脚本不会猜测接口地址。',
            downloadSaveResponse: '官网未返回完整、受支持的 ZIP。请检查登录状态，尝试官网手动下载。',
            downloadSaveTransfer: 'ZIP 传输失败、中断或超时；已保存的文件保留。',
            downloadSaveWrite: '结果文件未能提交保存。请检查目录权限、剩余空间和其他写入程序；已保存的文件保留。',
            downloadSaveCleanup: '未能清理本次新建的未完成文件 {name}，请手动删除该文件后重试；脚本不会覆盖已有文件。',
            downloadSaveLocked: '另一页面正在保存本批次结果，请先停止那次保存再重试。',
            scoreExtract: '提取 results 数据为 CSV…', scoreRunning: '运行中：正在提取本地 ZIP 指标',
            scoreHint: '本地读取批次 results 中的全部 ZIP，无需查找官网任务或下载。优先沿用已打开批次，否则选择文件夹；输出每包最佳模型/链对 CSV 和整批最佳/全模型/缺失表。替换已有 CSV 前确认，不改 ZIP、输入文件或清单。',
            scoreReading: '正在读取 ZIP {index}/{total}：{name}…', scoreWriting: '已保存 CSV {saved}/{total}；正在写入 {name}…',
            scoreConfirm: '已读取 {count} 个 ZIP、{models} 条模型记录。将 {files} 个 CSV 保存到 {folder}/results？将覆盖的已有生成 CSV：{existing} 个。\n{names}\n原 ZIP、输入文件和 manifest.json 不修改。',
            scoreDone: '已保存 {saved} 个 CSV 到 {folder}/results：{zips} 个 ZIP，{jobs} 个任务，{models} 个模型；清单中 {missing} 个任务没有本地结果。',
            scoreCancelled: '提取已取消/停止。已保存 {saved} 个 CSV，之前已提交的文件保留。',
            scoreError: '提取已停止。已保存 {saved} 个 CSV。{detail}',
            scoreInvalidZip: 'ZIP 无效、截断或 CRC 不匹配：{name}；未接受此包的指标。',
            scoreUnsupportedZip: '不支持的 ZIP 格式/压缩方式：{name}。仅支持普通单卷、非 ZIP64 的存储或 deflate ZIP。',
            scoreUnsupportedBrowser: '当前浏览器无法解压 deflate-raw ZIP 条目，请使用新版 Edge/Chrome。',
            scoreInvalidData: 'AlphaFold 指标 JSON 或矩阵维度无效：{name}；未为未完整解析的数据写报告。',
            scoreLimit: '提取超过支持的 ZIP/JSON/CSV/行数上限：{name}。请将结果拆成较小批次。',
            scoreNoZips: 'results 中未找到 ZIP；请选择包含 manifest.json 和 results 子目录的批次文件夹。',
            scoreNoModels: 'ZIP 中未找到 summary_confidences 模型指标：{name}。',
            scoreAmbiguous: '结果身份/序列冲突或与清单匹配有歧义：{name}；未写入 CSV。',
            scoreOutputConflict: '生成的 CSV 文件名冲突或不安全，未写入 CSV。',
            scoreSourceChanged: '提取期间输入或输出文件发生变化，已停止，不覆盖已变化的文件。',
            scoreFileError: '无法读写文件，请检查 results 目录权限、剩余空间和其他写入程序。',
        },
        ja: { submitTitle: 'ジョブを送信', downloadTitle: 'ジョブをダウンロード', downloadStart: '開始日', downloadEnd: '終了日', downloadScan: 'ジョブを検索', downloadAll: '全選択', downloadClear: '選択解除', downloadApply: '公式サイトの選択に反映' },
        ko: { submitTitle: '작업 제출', downloadTitle: '작업 다운로드', downloadStart: '시작일', downloadEnd: '종료일', downloadScan: '작업 찾기', downloadAll: '전체 선택', downloadClear: '선택 해제', downloadApply: '웹사이트 선택에 적용' },
        es: { submitTitle: 'Enviar tareas', downloadTitle: 'Descargar tareas', downloadStart: 'Desde', downloadEnd: 'Hasta', downloadScan: 'Buscar tareas', downloadAll: 'Seleccionar todo', downloadClear: 'Borrar selección', downloadApply: 'Aplicar selección en la web' },
        fr: { submitTitle: 'Envoyer des tâches', downloadTitle: 'Télécharger des tâches', downloadStart: 'Du', downloadEnd: 'Au', downloadScan: 'Rechercher', downloadAll: 'Tout sélectionner', downloadClear: 'Tout désélectionner', downloadApply: 'Appliquer la sélection au site' },
    };
    for (const language of Object.keys(I18N)) {
        Object.assign(I18N[language], downloadEnglish, downloadTranslations[language] || {});
    }

    const accountEnglish = {
        tasksPage: 'Jobs', accountsPage: 'Accounts', accountsIntro: 'Accounts and quota records are saved locally in Tampermonkey. Only the signed-in account can update its quota; other accounts show historical records.',
        accountsCount: '{count} saved accounts', accountsEmpty: 'No saved accounts. Sign in to record the current account, or add an email below.',
        accountEmailLabel: 'Email', accountNoteLabel: 'Note (optional)', accountAdd: 'Save account', accountSave: 'Save changes', accountCancel: 'Cancel edit',
        accountCurrent: 'Current account', accountEdit: 'Edit', accountRemove: 'Remove', accountRemoveConfirm: 'Remove the local record for {email}? This does not delete the website account.',
        accountLiveQuota: 'Website quota: {count}', accountSavedQuota: 'Last recorded quota: {count}', accountNoQuota: 'Quota not recorded', accountRecordedAt: 'Recorded: {time}',
        accountRefresh: 'Record current quota', accountLogin: 'Sign in / switch in InPrivate', accountLoginHelp: 'Opens https://alphafoldserver.com/ in Edge InPrivate. Sign in on the website; this normal window stays signed in. Allow Tampermonkey in InPrivate, then set Tampermonkey Settings > Security > Store data in incognito mode to Permanent to share the local account list. InPrivate sign-in cookies remain temporary; close all InPrivate windows to start a fresh session.',
        accountPrivateOpened: 'Requested the AlphaFold Server homepage in InPrivate. Sign in there and check the account email. If no tab appears, allow Tampermonkey in InPrivate and try again.',
        accountPrivateUnavailable: 'Could not open InPrivate. Allow Tampermonkey in Edge InPrivate settings, then retry; or open an InPrivate window manually.',
        accountSwitchBusy: 'Stop processing before switching accounts.',
        accountInvalid: 'Enter a valid email address.', accountSaved: 'Account saved.', accountRemoved: 'Local record removed.', accountUpdated: 'Current account quota recorded.',
        accountReadFailed: 'Current account or quota is unavailable. Check sign-in and the website quota display.',
        accountStorageError: 'Account storage is unavailable or invalid. Changes are kept only on this page.', accountChanged: 'The signed-in account changed. Processing stopped; check the website account and history before reloading.',
    };
    const accountTranslations = {
        zh: {
            tasksPage: '任务', accountsPage: '账户管理', accountsIntro: '账号与额度记录保存在 Tampermonkey 本机存储中。仅当前登录账号可更新额度，其他账号显示历史记录。',
            accountsCount: '已保存 {count} 个账号', accountsEmpty: '暂无账号。登录后会记录当前账号，也可在下方添加邮箱。',
            accountEmailLabel: '邮箱', accountNoteLabel: '备注（可选）', accountAdd: '保存账号', accountSave: '保存修改', accountCancel: '取消编辑',
            accountCurrent: '当前账号', accountEdit: '编辑', accountRemove: '移除', accountRemoveConfirm: '移除 {email} 的本地记录？不会删除官网账号。',
            accountLiveQuota: '官网当前额度：{count} 个', accountSavedQuota: '上次记录额度：{count} 个', accountNoQuota: '尚未记录额度', accountRecordedAt: '记录时间：{time}',
            accountRefresh: '记录当前额度', accountLogin: '在 InPrivate 中登录 / 切换', accountLoginHelp: '在 Edge InPrivate 中直接打开 https://alphafoldserver.com/，请在官网操作登录，普通窗口保持原登录。需在 Edge 扩展详情中允许 Tampermonkey 在 InPrivate 中运行，并在 Tampermonkey 设置 > Security 中将“Store data in incognito mode”设为 Permanent，账号、备注和额度记录才会与普通窗口共用并保存在本机。InPrivate 登录 Cookie 仍是独立临时会话；关闭全部 InPrivate 窗口后可从空会话开始。',
            accountPrivateOpened: '已请求在 InPrivate 中打开 AlphaFold Server 首页，请在官网登录并核对账号邮箱。若未打开，请确认已允许 Tampermonkey 在 InPrivate 中运行。',
            accountPrivateUnavailable: '无法打开 InPrivate。请在 Edge 扩展详情中允许 Tampermonkey 在 InPrivate 中运行后重试；也可手动打开 InPrivate 窗口。',
            accountSwitchBusy: '请先停止任务，再切换账号。',
            accountInvalid: '请输入有效邮箱。', accountSaved: '账号已保存。', accountRemoved: '本地记录已移除。', accountUpdated: '已记录当前账号的官网额度。',
            accountReadFailed: '无法读取当前账号或额度，请检查登录状态与官网额度显示。', accountStorageError: '账号本地存储不可用或记录无效，改动仅在当前页面有效。',
            accountChanged: '登录账号已变化，已停止处理；请核对官网账号与历史记录后刷新页面。',
        },
        ja: { tasksPage: 'ジョブ', accountsPage: 'アカウント管理', accountEmailLabel: 'メール', accountNoteLabel: 'メモ（任意）', accountAdd: '保存', accountSave: '変更を保存', accountCancel: '編集を取消', accountCurrent: '現在のアカウント', accountEdit: '編集', accountRemove: '削除', accountRefresh: '現在の残り枠を記録', accountLogin: '公式サイトでログイン / 切替' },
        ko: { tasksPage: '작업', accountsPage: '계정 관리', accountEmailLabel: '이메일', accountNoteLabel: '메모 (선택)', accountAdd: '계정 저장', accountSave: '변경 저장', accountCancel: '편집 취소', accountCurrent: '현재 계정', accountEdit: '편집', accountRemove: '삭제', accountRefresh: '현재 할당량 기록', accountLogin: '웹사이트 로그인 / 전환' },
        es: { tasksPage: 'Tareas', accountsPage: 'Cuentas', accountEmailLabel: 'Correo', accountNoteLabel: 'Nota (opcional)', accountAdd: 'Guardar cuenta', accountSave: 'Guardar cambios', accountCancel: 'Cancelar edición', accountCurrent: 'Cuenta actual', accountEdit: 'Editar', accountRemove: 'Eliminar', accountRefresh: 'Registrar cuota actual', accountLogin: 'Iniciar sesión / cambiar' },
        fr: { tasksPage: 'Tâches', accountsPage: 'Comptes', accountEmailLabel: 'E-mail', accountNoteLabel: 'Note (facultatif)', accountAdd: 'Enregistrer', accountSave: 'Enregistrer les modifications', accountCancel: 'Annuler', accountCurrent: 'Compte actuel', accountEdit: 'Modifier', accountRemove: 'Supprimer', accountRefresh: 'Enregistrer le quota actuel', accountLogin: 'Connexion / changer de compte' },
    };
    for (const language of Object.keys(I18N)) {
        Object.assign(I18N[language], accountEnglish, accountTranslations[language] || {});
    }

    // Legacy flags prevent a second same-realm instance during an in-place upgrade.
    if (window.__af3AutoSubmitterLoaded || window.__af3AutoSubmitterDevLoaded || window.__af3AutoSubmitterV24Loaded) return;
    window.__af3AutoSubmitterLoaded = true;
    window.__af3AutoSubmitterDevLoaded = true;
    window.__af3AutoSubmitterV24Loaded = true;

    // FASTA data stays local until the explicit native-upload confirmation.
    const fastaEnglish = {
        fastaTitle: 'FASTA batches', fastaHelp: 'Each >name is a job title; each following sequence line is a protein chain. 30 jobs per batch. Save locally before uploading drafts; no prediction is launched.',
        fastaFile: 'FASTA file',
        fastaGenerate: 'Generate and choose folder', fastaRestore: 'Open existing batch folder', fastaImport: 'Import next batch as drafts',
        fastaSync: 'Check history / update records', fastaStop: 'Stop', fastaIdle: 'Each >name starts a job. Each non-empty sequence line is one protein chain; a wrapped line is a new chain. Only proteins are generated.',
        fastaLocal: 'Saved to {folder}. Generated {total}; imported {imported}; submitted {submitted}; completed {completed}; failed {failed}.',
        fastaBatch: 'Batch {index}: {count} jobs · {status}', fastaBusy: 'Working…', fastaReady: 'Ready', fastaImported: 'Import confirmed', fastaUncertain: 'Needs history check',
        fastaRunning: 'Reading / saving local files…', fastaChecking: 'Checking website history…', fastaUploading: 'Validating batch {index} on the website…',
        fastaCheckingPage: 'Checking website history… page {page}; {count} rows read.',
        fastaCheckingTotal: 'Checking website history… page {page}; {count}/{total} rows read ({percent}%).',
        fastaProgress: 'FASTA operation progress; history scanning, not prediction completion',
        fastaHistoryReturning: 'History read. Returning to the first page…',
        fastaUpdating: 'History read. Checking and saving local records…',
        fastaChecked: 'History check complete: verified {matched}/{total} tracked jobs in the current filters. Records saved.',
        fastaLogCheckStart: 'History check started: account {account}; filters {filters}.',
        fastaLogImportStart: 'Import started: batch {index} ({count} jobs); account {account}.',
        fastaLogPageSize: 'History scan page size: 100 rows.',
        fastaLogScan: 'History read: {names} names, {rows} rows.',
        fastaLogBatch: 'Batch {index} ({count} jobs): confirmed {confirmed}; duplicate titles resolved {resolved}; unverified {unverified}; status {status}.',
        fastaLogResult: 'History check result: verified {matched}/{total}; unverified {unverified}.',
        fastaLogSaveSent: 'Draft save sent for batch {index}; verifying history…',
        fastaLogConfirmed: 'Batch {index} import confirmed.',
        fastaLogError: 'Stopped: {detail}',
        fastaCheckUnverified: '{unverified} same-name records lack evidence of this run saving a draft; import was not confirmed.',
        fastaNoImports: 'No script import records for this run; matching titles alone cannot link history. If not uploaded, use “Import next batch as drafts”. Do not reimport jobs already uploaded manually.',
        fastaOtherAccount: 'No tracked batches belong to this account. Switch to the original import account; other accounts’ job records were not changed.',
        fastaVerifying: 'Draft save sent once. Verifying batch {index} in history…', fastaFinished: 'All batches are confirmed imported. This does not mean predictions are complete.',
        fastaUnsupported: 'This browser cannot choose writable folders. Use a supported Edge/Chrome window; no files were uploaded.',
        fastaChooseFile: 'Choose a non-empty UTF-8 FASTA file (up to 50 MiB).', fastaInvalid: 'FASTA record / line {record}: {reason}',
        fastaSequence: 'Use only the 20 standard amino acids. Gaps, *, ambiguous letters and chain separators are not silently removed.',
        fastaLength: 'Each job needs at least one protein chain; each chain ≤ 2700 residues and all chains together ≤ 3000.',
        fastaDirectory: 'Choose the batch folder containing manifest.json. Missing, changed or unsupported files cannot be resumed.',
        fastaJournalChanged: 'Another page changed or is writing this manifest. Reopen the folder and check history; the newer journal was not overwritten.',
        fastaManifestLimit: 'The tracking manifest exceeds 50 MiB or 10,000 batches. Use a smaller input; unsupported runs are not written.',
        fastaSavedError: 'Local record write failed. Processing stopped; do not retry an uncertain import. Reopen the folder and check history. {detail}',
        fastaContextAccountMissing: 'Stopped: cannot identify the signed-in account. Sign in and wait for the panel to show your email, then retry.',
        fastaContextSearch: 'Stopped: Search History is not empty. Clear the website search box and retry.',
        fastaContextFilters: 'Stopped: Select Saved draft, Completed, In progress or Failed in website History, then retry.',
        fastaContextExamples: 'Stopped: Examples cannot be checked. Deselect Examples in website History, then retry.',
        fastaAccountChanged: 'Stopped: the account changed during the operation. Return to the original account and check history again.',
        fastaFiltersChanged: 'Stopped: History filters changed during the operation. Keep the filters unchanged and check history again.',
        fastaPageSizeChanged: 'Stopped: the page size changed during the operation. Keep it unchanged and check history again.',
        fastaSortChanged: 'Stopped: History sort changed during the operation. Keep the sort unchanged and check history again.',
        fastaPageChanged: 'Stopped: the page address changed during the operation. Return to History and check again.',
        fastaNeedDraft: 'Select Saved draft only before importing. Existing dialogs/menus must be closed.',
        fastaCloseDialog: 'Close website dialogs and menus before checking or importing records.',
        fastaConfirm: 'Upload batch {index} ({count} jobs) to {account}? Selecting the JSON sends sequences for website validation. Only drafts will be saved; no prediction is launched.',
        fastaExisting: 'A batch task name already exists in history. Nothing was uploaded. Check records instead of importing it again.',
        fastaIdentity: 'A reused task title cannot identify a prediction without matching saved job IDs. Completion was not recorded; verify the website history.',
        fastaPreview: 'Native upload validation failed or did not show exactly the expected names, count and all-green job checks. No draft-save retry was sent.',
        fastaTimeout: 'Import is unconfirmed or partial. Check history; do not automatically reimport. {detail}',
        fastaStopped: 'Stopped. Saved records are retained; any draft-save request already sent still needs history verification.',
        fastaChanged: 'A saved batch file or manifest is invalid/changed. Generate a new run instead of importing mismatched files.',
        fastaInputChanged: 'Input changed. Generate and save a new run or reopen its batch folder before importing.',
        fastaSummary: 'Protein jobs {count}; batches {batches}; first job chain lengths {lengths}.',
    };
    Object.assign(I18N.en, fastaEnglish);
    for (const lang of Object.keys(I18N)) if (lang !== 'en') Object.assign(I18N[lang], fastaEnglish);
    Object.assign(I18N.zh, {
        fastaTitle: 'FASTA 分批导入', fastaHelp: '>名称作为任务名，后续每行序列是一条蛋白链；每批 30 个任务。先保存 FASTA、官网 JSON 和 manifest，再确认上传草稿，不启动预测。',
        fastaFile: 'FASTA 文件',
        fastaGenerate: '生成并选择保存目录', fastaRestore: '打开已有批次文件夹', fastaImport: '导入下一批为草稿',
        fastaSync: '核对官网历史 / 更新记录', fastaStop: '停止', fastaIdle: '每个 >名称开始新任务；每个非空序列行是一条链，不拼接、不自动拆肽。只支持纯蛋白，长链请勿手动折行。',
        fastaLocal: '已保存至 {folder}。生成 {total}，已导入 {imported}，已提交 {submitted}，已完成 {completed}，失败 {failed}。',
        fastaBatch: '第 {index} 批：{count} 个 · {status}', fastaBusy: '处理中…', fastaReady: '待导入', fastaImported: '已确认导入', fastaUncertain: '需核对历史',
        fastaRunning: '正在读取 / 保存本地文件…', fastaChecking: '正在核对官网历史…', fastaUploading: '正在官网校验第 {index} 批…',
        fastaCheckingPage: '正在核对官网历史：第 {page} 页，已读取 {count} 条记录…',
        fastaCheckingTotal: '正在核对官网历史：第 {page} 页，已读取 {count}/{total} 条（{percent}%）…',
        fastaProgress: 'FASTA 操作进度；历史扫描进度，不是预测完成进度',
        fastaHistoryReturning: '历史读取完成，正在回到首页…',
        fastaUpdating: '历史读取完成，正在核对并保存本地记录…',
        fastaChecked: '核对完成：当前筛选下确认 {matched}/{total} 个跟踪任务，记录已保存。',
        fastaLogCheckStart: '开始核对历史：账号 {account}；筛选 {filters}。',
        fastaLogImportStart: '开始导入：第 {index} 批（{count} 个）；账号 {account}。',
        fastaLogPageSize: '历史扫描每页数量：100 个。',
        fastaLogScan: '历史读取完成：{names} 个名称，共 {rows} 行。',
        fastaLogBatch: '第 {index} 批（{count} 个）：已确认 {confirmed}；同名消歧 {resolved}；未确认 {unverified}；状态 {status}。',
        fastaLogResult: '核对结果：确认 {matched}/{total}；未确认 {unverified}。',
        fastaLogSaveSent: '第 {index} 批已发送草稿保存，正在核对历史…',
        fastaLogConfirmed: '第 {index} 批已确认导入。',
        fastaLogError: '已停止：{detail}',
        fastaCheckUnverified: '{unverified} 条同名记录缺少本次草稿保存证据，未确认导入。',
        fastaNoImports: '本清单尚无脚本导入记录，无法仅凭同名历史自动关联。未上传时请用“导入下一批为草稿”；若已手动上传，请勿重复导入。',
        fastaOtherAccount: '当前账号没有对应的跟踪批次，请切换到原导入账号核对；未更改其他账号的任务记录。',
        fastaVerifying: '草稿保存已点击一次，正在历史中核对第 {index} 批…', fastaFinished: '全部批次已确认导入；这不代表预测已完成。',
        fastaUnsupported: '当前浏览器无法选择可写文件夹，请使用支持此功能的 Edge/Chrome 窗口。未上传任何文件。',
        fastaChooseFile: '请选择非空 UTF-8 FASTA 文件（最大 50 MiB）。', fastaInvalid: 'FASTA 记录 / 行 {record}：{reason}',
        fastaSequence: '只接受 20 种标准氨基酸；不会静默删除缺口、*、不明确字母或链分隔符。',
        fastaLength: '每个任务至少一条蛋白链，每链不超过 2700 个残基，所有链合计不超过 3000 个。',
        fastaDirectory: '请选择包含 manifest.json 的批次文件夹；文件缺失、内容改变或格式不支持时不能恢复。',
        fastaJournalChanged: '清单已被其他页面修改或正在写入；未覆盖新记录。请重新打开目录并核对历史。',
        fastaManifestLimit: '跟踪清单超过 50 MiB 或 10000 批，请缩小输入；不写入无法恢复的批次。',
        fastaSavedError: '本地记录写入失败，已停止；不要重试结果不明确的导入。请重新打开目录并核对历史。{detail}',
        fastaContextAccountMissing: '已停止：无法识别当前登录账号。请先登录，等面板顶部显示邮箱后重试。',
        fastaContextSearch: '已停止：官网 Search History 搜索框不是空的。请清空搜索后重试。',
        fastaContextFilters: '已停止：官网 History 未选中任务状态。请至少选择 Saved draft、Completed、In progress 或 Failed 后重试。',
        fastaContextExamples: '已停止：不能核对官网示例任务。请在 History 中取消 Examples 后重试。',
        fastaAccountChanged: '已停止：处理中登录账号发生变化。请切回原账号后重新核对历史。',
        fastaFiltersChanged: '已停止：处理中 History 筛选发生变化。请保持筛选不变后重新核对。',
        fastaPageSizeChanged: '已停止：处理中每页数量发生变化。请保持每页数量不变后重新核对。',
        fastaSortChanged: '已停止：处理中 History 排序发生变化。请保持排序不变后重新核对。',
        fastaPageChanged: '已停止：处理中页面地址发生变化。请返回 History 后重新核对。',
        fastaNeedDraft: '导入前请仅选择 Saved draft，并关闭已有官网弹窗和菜单。',
        fastaCloseDialog: '请先关闭官网已有弹窗和菜单，再核对或导入记录。',
        fastaConfirm: '将第 {index} 批（{count} 个任务）上传至 {account}？选择 JSON 就会发送序列进行官网校验；仅保存草稿，不启动预测。',
        fastaExisting: '官网已存在本批任务名称，未上传。请核对记录，不要重复导入。',
        fastaIdentity: '任务标题可能被复用，缺少可匹配的已保存任务 ID，未记录预测完成。请核对官网历史，不按名称猜认。',
        fastaPreview: '官网上传校验未通过，或名称、数量、全绿校验状态不符。未再次点击草稿保存。',
        fastaTimeout: '导入结果不明确或仅部分保存。请核对历史，不自动重导。{detail}',
        fastaStopped: '已停止并保留本地记录；已发送的草稿保存请求仍需核对历史。',
        fastaChanged: '批次文件或 manifest 格式错误 / 内容已改变，请重新生成，不导入不匹配的文件。',
        fastaInputChanged: '输入已改变；请生成保存新批次，或重新打开原批次文件夹后再导入。',
        fastaSummary: '蛋白任务 {count} 个，批次 {batches}；首条任务各链长度：{lengths}。',
    });
    const FASTA_IMPORT_TIMEOUT = 60000;
    const FASTA_FILE_LIMIT = 50 * 1024 * 1024;
    const FASTA_MANIFEST_LIMIT = 50 * 1024 * 1024;
    const FASTA_MAX_BATCHES = 10000;
    const fastaState = { error: false, busy: false, stop: false, dir: null, manifest: null, saved: false, inputChanged: false, context: null, message: '', dialog: null, progress: null };

    async function fastaHash(value) {
        const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function parseFasta(text) {
        const records = [];
        for (const [index, raw] of text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).entries()) {
            const line = raw.trim();
            if (!line) continue;
            if (line.startsWith('>')) {
                if (!line.slice(1).trim()) throw new Error(t('fastaInvalid', { record: index + 1, reason: 'Empty header' }));
                if (records.length >= 30 * FASTA_MAX_BATCHES) throw new Error(t('fastaManifestLimit'));
                records.push({ header: line.slice(1).trim(), chains: [], line: index + 1 });
            } else {
                if (!records.length) throw new Error(t('fastaInvalid', { record: index + 1, reason: 'Sequence before first > header' }));
                const chain = line.replace(/\s/g, '');
                // Validate ASCII before uppercasing: Unicode ß must not become two serines.
                if (!/^[ACDEFGHIKLMNPQRSTVWYacdefghiklmnpqrstvwy]+$/.test(chain)) throw new Error(t('fastaInvalid', { record: index + 1, reason: t('fastaSequence') }));
                records[records.length - 1].chains.push(chain.toUpperCase());
            }
        }
        if (!records.length) throw new Error(t('fastaChooseFile'));
        for (const record of records) {
            if (!record.chains.length || record.chains.some(chain => chain.length > 2700) ||
                record.chains.reduce((sum, chain) => sum + chain.length, 0) > 3000) {
                throw new Error(t('fastaInvalid', { record: record.line, reason: t('fastaLength') }));
            }
        }
        return records;
    }

    async function writeFastaFile(name, content) {
        const handle = await fastaState.dir.getFileHandle(name, { create: true });
        const writer = await handle.createWritable({ mode: 'exclusive' });
        try { await writer.write(content); await writer.close(); }
        catch (error) { try { await writer.abort(); } catch (_) {} throw error; }
    }

    function updateFastaSummary(manifest = fastaState.manifest) {
        const jobs = manifest.batches.flatMap(batch => batch.jobs);
        manifest.summary = {
            generated: jobs.length, imported: jobs.filter(job => job.importStatus === 'confirmed').length,
            submitted: jobs.filter(job => job.submittedAt || ['in_progress', 'completed', 'failed'].includes(job.predictionStatus)).length,
            completed: jobs.filter(job => job.predictionStatus === 'completed').length,
            failed: jobs.filter(job => job.predictionStatus === 'failed').length,
        };
        manifest.importComplete = manifest.summary.imported === jobs.length;
        manifest.predictionComplete = manifest.summary.completed === jobs.length;
        manifest.predictionFinished = manifest.summary.completed + manifest.summary.failed === jobs.length;
        manifest.updatedAt = new Date().toISOString();
    }

    async function persistFastaManifest() {
        fastaState.saved = false;
        const manifest = fastaState.manifest;
        updateFastaSummary(manifest);
        try {
            if (!navigator.locks?.request || !Number.isSafeInteger(manifest.revision) || manifest.revision < 0 || manifest.revision >= Number.MAX_SAFE_INTEGER) throw new Error(t('fastaJournalChanged'));
            await navigator.locks.request('af3-fasta-manifest:' + manifest.runId, { ifAvailable: true }, async lock => {
                if (!lock) throw new Error(t('fastaJournalChanged'));
                const revision = manifest.revision;
                const handle = await fastaState.dir.getFileHandle('manifest.json', { create: revision === 0 });
                const writer = await handle.createWritable({ mode: 'exclusive' });
                try {
                    // Read committed bytes while owning the writer, then compare-and-replace.
                    const file = await handle.getFile();
                    if (file.size > FASTA_MANIFEST_LIMIT) throw new Error(t('fastaManifestLimit'));
                    const disk = file.size ? JSON.parse(await file.text()) : null;
                    if ((revision === 0 && disk) || (revision > 0 && (!disk || disk.format !== manifest.format || disk.version !== manifest.version || disk.runId !== manifest.runId || disk.revision !== revision || disk.source?.sha256 !== manifest.source.sha256 || disk.source?.records !== manifest.source.records))) throw new Error(t('fastaJournalChanged'));
                    const text = JSON.stringify({ ...manifest, revision: revision + 1 }, null, 2) + '\n';
                    if (new Blob([text]).size > FASTA_MANIFEST_LIMIT) throw new Error(t('fastaManifestLimit'));
                    await writer.write(text); await writer.close();
                    manifest.revision = revision + 1;
                } catch (error) { try { await writer.abort(); } catch (_) {} throw error; }
            });
            fastaState.saved = true;
        } catch (error) { throw new Error(t('fastaSavedError', { detail: error.message })); }
        renderFastaSection();
    }

    function fastaCheck() {
        if (fastaState.stop) throw makeStoppedError();
        if (!fastaState.context) return;
        const before = JSON.parse(fastaState.context), current = JSON.parse(getFastaContext());
        for (const [key, message] of [['account', 'fastaAccountChanged'], ['selected', 'fastaFiltersChanged'],
            ['size', 'fastaPageSizeChanged'], ['sort', 'fastaSortChanged'], ['url', 'fastaPageChanged']]) {
            if (JSON.stringify(before[key]) !== JSON.stringify(current[key])) throw new Error(t(message));
        }
    }

    async function fastaWait(read, timeout = FASTA_IMPORT_TIMEOUT) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            fastaCheck();
            const result = read();
            if (result) return result;
            await sleep(100);
        }
        throw new Error(t('fastaTimeout', { detail: 'Timeout' }));
    }

    function getFastaContext() {
        const { root } = getDownloadHistory(true);
        const loading = downloadHistoryLoading(root, true);
        const previous = loading && fastaState.context ? JSON.parse(fastaState.context) : null;
        const account = normalizeAccountEmail(readAccountEmail());
        const search = root.querySelector('input[placeholder="Search History"], input[aria-label="Search History"]');
        const selected = getSelectedHistoryStatuses(root);
        if (!account) throw new Error(t('fastaContextAccountMissing'));
        if (search?.value) throw new Error(t('fastaContextSearch'));
        if (!selected.length) throw new Error(t('fastaContextFilters'));
        if (selected.includes('examples')) throw new Error(t('fastaContextExamples'));
        const size = root.querySelector('mat-paginator .mat-mdc-select-value, mat-paginator select');
        return JSON.stringify({ url: location.href, account, selected, size: size?.tagName === 'SELECT' ? (/^\d+$/.test(size.value) ? size.value : downloadText(size.selectedOptions[0])) : downloadText(size) || previous?.size || '',
            sort: loading ? previous?.sort || [] : Array.from(root.querySelectorAll('th[aria-sort]'), node => [downloadText(node), node.getAttribute('aria-sort')]) });
    }

    async function fastaHistoryPage(before = null, deadline = null) {
        let signature = '', since = 0;
        return fastaWait(() => {
            const history = getDownloadHistory(true);
            if (downloadHistoryLoading(history.root, true)) { signature = ''; return false; }
            const page = readDownloadPage();
            if (before !== null && before === page.signature) return false;
            if (signature !== page.signature) { signature = page.signature; since = Date.now(); return false; }
            return Date.now() - since >= 150 && page;
        }, deadline === null ? 8000 : Math.max(1, deadline - Date.now()));
    }

    async function readFastaHistory(deadline = null) {
        let page = await fastaHistoryPage(null, deadline);
        const move = async button => { fastaCheck(); if (!downloadButtonEnabled(button)) throw new Error(t('downloadPageError')); button.click(); return fastaHistoryPage(page.signature, deadline); };
        if (downloadButtonEnabled(page.first)) page = await move(page.first);
        const rewind = new Set();
        while (downloadButtonEnabled(page.previous)) {
            if (rewind.has(page.signature) || rewind.size >= 1000) throw new Error(t('downloadPageError'));
            rewind.add(page.signature); page = await move(page.previous);
        }
        const found = new Map(), visited = new Set();
        const account = JSON.parse(fastaState.context).account;
        const trackedNames = new Set(fastaState.manifest.batches.filter(batch => batch.account === account).flatMap(batch => batch.jobs.map(job => job.name)));
        let scanned = 0, total = null;
        while (true) {
            fastaCheck();
            if (visited.has(page.signature) || visited.size >= 1000) throw new Error(t('downloadPageError'));
            visited.add(page.signature);
            scanned += page.jobs.length;
            const match = /\bof\s+(\d{1,3}(?:,\d{3})+|\d+)\s*$/i.exec(page.range);
            const reported = match ? Number(match[1].replace(/,/g, '')) : NaN;
            if (visited.size === 1) total = reported;
            // ponytail: percentages require a stable native total; otherwise use indeterminate progress.
            if (!Number.isSafeInteger(reported) || reported <= 0 || reported < scanned || total !== reported ||
                (!downloadButtonEnabled(page.next) && reported !== scanned)) total = null;
            fastaState.progress = total === null ? null : { value: scanned, max: total };
            fastaState.message = total === null ? t('fastaCheckingPage', { page: visited.size, count: scanned }) :
                t('fastaCheckingTotal', { page: visited.size, count: scanned, total, percent: Math.floor(scanned / total * 100) });
            renderFastaSection();
            for (let job of page.jobs) {
                const cell = job.row.querySelector('.mat-column-status, .cdk-column-status');
                const statusText = ((cell?.textContent || '') + ' ' + Array.from(cell?.querySelectorAll('[aria-label], [mattooltip]') || [], n => n.getAttribute('aria-label') || n.getAttribute('mattooltip')).join(' ')).toLowerCase();
                const selected = JSON.parse(fastaState.context).selected;
                const status = /check_circle|completed|succeeded/.test(statusText) ? 'completed' : /\berror\b|failed/.test(statusText) ? 'failed' :
                    (/progress_activity|in progress|pending/.test(statusText) || cell?.querySelector('mat-spinner, mat-progress-spinner')) ? 'in_progress' : /edit_document|saved draft/.test(statusText) ? 'draft' :
                    selected.length === 1 ? ({ 'saved draft': 'draft', 'completed': 'completed', 'failed': 'failed', 'in progress': 'in_progress' })[selected[0]] : 'unknown';
                if (!job.id && trackedNames.has(job.name) && ['completed', 'failed', 'in_progress'].includes(status)) {
                    job = await resolveDownloadJob(job, fastaCheck);
                    if (!job.id) throw new Error(t('fastaIdentity'));
                }
                const entry = { name: job.name, jobId: job.id ? job.key.slice(3) : null, modified: job.modified, status };
                if (!found.has(job.name)) found.set(job.name, []);
                found.get(job.name).push(entry);
            }
            if (!downloadButtonEnabled(page.next)) break;
            page = await move(page.next);
        }
        fastaState.progress = null; fastaState.message = t('fastaHistoryReturning'); renderFastaSection();
        if (downloadButtonEnabled(page.first)) page = await move(page.first);
        const returning = new Set();
        while (downloadButtonEnabled(page.previous)) {
            if (returning.has(page.signature) || returning.size >= 1000) throw new Error(t('downloadPageError'));
            returning.add(page.signature); page = await move(page.previous);
        }
        fastaCheck();
        return found;
    }

    async function readSavedFastaBatch(batch) {
        const file = await (await fastaState.dir.getFileHandle(batch.jsonFile)).getFile();
        if (file.size > FASTA_FILE_LIMIT) throw new Error(t('fastaChanged'));
        const text = await file.text();
        if (await fastaHash(text) !== batch.jsonSha256) throw new Error(t('fastaChanged'));
        const jobs = JSON.parse(text);
        if (!Array.isArray(jobs) || jobs.length !== batch.jobs.length || jobs.some((job, i) =>
            job.name !== batch.jobs[i].name || job.dialect !== 'alphafoldserver' || job.version !== 1 ||
            !Array.isArray(job.modelSeeds) || job.modelSeeds.length || !Array.isArray(job.sequences) || !job.sequences.length ||
            !Array.isArray(batch.jobs[i].chainLengths) || job.sequences.length !== batch.jobs[i].chainLengths.length ||
            job.sequences.some((chain, position) => !chain || Object.keys(chain).length !== 1 || chain.proteinChain?.count !== 1 ||
                typeof chain.proteinChain.sequence !== 'string' || !/^[ACDEFGHIKLMNPQRSTVWY]+$/.test(chain.proteinChain.sequence) ||
                chain.proteinChain.sequence.length > 2700 || chain.proteinChain.sequence.length !== batch.jobs[i].chainLengths[position]))) {
            throw new Error(t('fastaChanged'));
        }
        if (jobs.some(job => job.sequences.reduce((sum, chain) => sum + chain.proteinChain.sequence.length, 0) > 3000)) throw new Error(t('fastaChanged'));
        return text;
    }

    async function generateFastaBatches() {
        if (fastaState.busy || isRunning || downloadState.busy) return;
        if (typeof window.showDirectoryPicker !== 'function') { fastaState.error = true; fastaState.message = t('fastaUnsupported'); renderFastaSection(); return; }
        const file = getUiElement('af3-fasta-file')?.files[0];
        if (!file?.size || file.size > FASTA_FILE_LIMIT) { fastaState.error = true; fastaState.message = t('fastaChooseFile'); renderFastaSection(); return; }
        fastaState.busy = true; fastaState.stop = false; fastaState.context = null; fastaState.progress = null;
        fastaState.message = t('fastaRunning'); renderFastaSection(); checkSystemStatus();
        try {
            // Request permission directly from the click, before asynchronous parsing consumes activation.
            const parent = await window.showDirectoryPicker({ mode: 'readwrite' });
            const sourceBytes = await file.arrayBuffer();
            const text = new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes);
            const records = parseFasta(text);
            fastaCheck();
            const runId = new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
            const folder = 'af3_' + runId;
            const stem = (file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) || 'input');
            const manifest = { format: 'af3-fasta-batches', version: 1, revision: 0, runId, createdAt: new Date().toISOString(), source: { name: file.name, sha256: await fastaHash(sourceBytes), records: records.length },
                settings: { batchSize: 30, sequenceFormat: 'protein-lines', chainLimit: 2700, totalLimit: 3000 }, generationComplete: false, batches: [] };
            const outputs = [], names = new Set(), suffixes = new Map();
            for (let start = 0; start < records.length; start += 30) {
                fastaCheck();
                const batch = { index: manifest.batches.length + 1, status: 'ready', account: null, attempts: [], jobs: [] };
                const base = stem + '_part' + String(batch.index).padStart(3, '0');
                batch.fastaFile = base + '.fasta'; batch.jsonFile = base + '.json';
                const part = records.slice(start, start + 30);
                const jobs = part.map((record, i) => {
                    const ordinal = start + i + 1;
                    const baseName = (record.header.replace(/\s+/g, ' ').replace(/[^A-Za-z0-9 _:-]+/g, '_').replace(/^_+|_+$/g, '').trim() || 'seq' + ordinal).slice(0, 100).trim();
                    let name = baseName, serial = suffixes.get(baseName) || 1;
                    while (names.has(name)) {
                        const suffix = '_' + (++serial);
                        name = baseName.slice(0, 100 - suffix.length) + suffix;
                    }
                    names.add(name); suffixes.set(baseName, serial);
                    batch.jobs.push({ record: ordinal, header: record.header, name, chainLengths: record.chains.map(chain => chain.length), importStatus: 'pending', predictionStatus: 'unknown', importedAt: null, submittedAt: null, completedAt: null, lastSeenAt: null, jobId: null });
                    return { name, modelSeeds: [], sequences: record.chains.map(sequence => ({ proteinChain: { sequence, count: 1 } })), dialect: 'alphafoldserver', version: 1 };
                });
                const fasta = part.map(record => '>' + record.header + '\n' + record.chains.join('\n')).join('\n') + '\n';
                const json = JSON.stringify(jobs, null, 2) + '\n';
                if (new Blob([fasta]).size > FASTA_FILE_LIMIT || new Blob([json]).size > FASTA_FILE_LIMIT) throw new Error(t('fastaChooseFile'));
                batch.fastaSha256 = await fastaHash(fasta); batch.jsonSha256 = await fastaHash(json);
                manifest.batches.push(batch); outputs.push({ batch, fasta, json });
            }
            updateFastaSummary(manifest);
            if (new Blob([JSON.stringify({ ...manifest, revision: manifest.batches.length + 1 }, null, 2) + '\n']).size > FASTA_MANIFEST_LIMIT) throw new Error(t('fastaManifestLimit'));
            fastaCheck();
            try { await parent.getDirectoryHandle(folder); throw new Error('Output folder already exists'); }
            catch (error) { if (error.name !== 'NotFoundError') throw error; }
            fastaState.dir = await parent.getDirectoryHandle(folder, { create: true });
            manifest.batches = [];
            fastaState.manifest = manifest; fastaState.saved = false; fastaState.inputChanged = false;
            for (const { batch, fasta, json } of outputs) {
                fastaCheck();
                await writeFastaFile(batch.fastaFile, fasta); await writeFastaFile(batch.jsonFile, json);
                manifest.batches.push(batch); await persistFastaManifest();
            }
            manifest.generationComplete = true;
            await persistFastaManifest();
            fastaState.message = t('fastaSummary', { count: records.length, batches: manifest.batches.length, lengths: records[0].chains.map(chain => chain.length).join(' + ') });
        } catch (error) {
            fastaState.error = error.name !== 'AbortError' && !isUserStopError(error);
            fastaState.message = fastaState.error ? error.message : t('fastaStopped');
        } finally { fastaState.busy = false; renderFastaSection(); checkSystemStatus(); }
    }

    async function readFastaManifest(dir) {
        const file = await (await dir.getFileHandle('manifest.json')).getFile();
        if (file.size > FASTA_MANIFEST_LIMIT) throw new Error(t('fastaManifestLimit'));
        const text = await file.text();
        const manifest = JSON.parse(text);
        if (manifest?.format !== 'af3-fasta-batches' || manifest.version !== 1 || !manifest.generationComplete ||
            manifest.settings?.batchSize !== 30 || (manifest.settings.sequenceFormat !== 'protein-lines' &&
                (manifest.settings.sequenceFormat !== undefined || !['monomer', 'complex'].includes(manifest.settings.mode))) ||
            !Number.isSafeInteger(manifest.revision) || manifest.revision < 1 || manifest.revision >= Number.MAX_SAFE_INTEGER ||
            !Number.isSafeInteger(manifest.source?.records) || manifest.source.records < 1 || manifest.source.records > 30 * FASTA_MAX_BATCHES ||
            !/^[\d]{14}_[a-f\d]{8}$/.test(manifest.runId) || !Array.isArray(manifest.batches) ||
            manifest.batches.length !== Math.ceil(manifest.source.records / 30)) throw new Error(t('fastaChanged'));
        const names = new Set();
        for (const [i, batch] of manifest.batches.entries()) {
            if (batch.index !== i + 1 || !/^[A-Za-z0-9_-]+_part\d+\.json$/.test(batch.jsonFile) || batch.fastaFile !== batch.jsonFile.replace(/\.json$/, '.fasta') ||
                !Array.isArray(batch.jobs) || batch.jobs.length !== Math.min(30, manifest.source.records - i * 30) || !Array.isArray(batch.attempts) ||
                (batch.account !== null && !normalizeAccountEmail(batch.account))) throw new Error(t('fastaChanged'));
            for (const [position, job] of batch.jobs.entries()) {
                if (job.record !== i * 30 + position + 1 || typeof job.name !== 'string' || (manifest.settings.sequenceFormat !== 'protein-lines' && !job.name.startsWith('af3_' + manifest.runId + '_')) || !/^[A-Za-z0-9 _:-]{1,100}$/.test(job.name) || names.has(job.name) ||
                    typeof job.header !== 'string' || !['pending', 'confirmed'].includes(job.importStatus) ||
                    !['unknown', 'draft', 'submitted', 'in_progress', 'completed', 'failed'].includes(job.predictionStatus)) throw new Error(t('fastaChanged'));
                names.add(job.name);
            }
        }
        return { manifest, text };
    }

    async function restoreFastaBatches() {
        if (fastaState.busy || isRunning || downloadState.busy) return;
        if (typeof window.showDirectoryPicker !== 'function') { fastaState.error = true; fastaState.message = t('fastaUnsupported'); renderFastaSection(); return; }
        fastaState.busy = true; fastaState.stop = false; fastaState.context = null; fastaState.progress = null; renderFastaSection(); checkSystemStatus();
        try {
            const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
            const { manifest } = await readFastaManifest(dir);
            const previous = { dir: fastaState.dir, manifest: fastaState.manifest, saved: fastaState.saved, inputChanged: fastaState.inputChanged };
            fastaState.dir = dir; fastaState.manifest = manifest; fastaState.saved = false; fastaState.inputChanged = false;
            try {
                for (const batch of manifest.batches) {
                    fastaCheck(); await readSavedFastaBatch(batch);
                    const fasta = await (await dir.getFileHandle(batch.fastaFile)).getFile();
                    if (fasta.size > FASTA_FILE_LIMIT || await fastaHash(await fasta.text()) !== batch.fastaSha256) throw new Error(t('fastaChanged'));
                    if (batch.attempts.some(attempt => !attempt || typeof attempt !== 'object' || !normalizeAccountEmail(attempt.account))) throw new Error(t('fastaChanged'));
                    const attempt = batch.attempts.at(-1);
                    if (attempt && !attempt.endedAt) { attempt.endedAt = new Date().toISOString(); attempt.result = 'interrupted'; }
                    // Never trust a manually reset ready flag after a draft-save request was journalled.
                    const confirmed = batch.jobs.filter(job => job.importStatus === 'confirmed').length;
                    batch.status = confirmed === batch.jobs.length ? 'imported' : confirmed ? 'partial' : batch.attempts.some(item => item.saveClickedAt && !(item.result === 'not_saved' && item.endedAt)) ? 'uncertain' : 'ready';
                }
                await persistFastaManifest();
            } catch (error) { Object.assign(fastaState, previous); throw error; }
            getUiElement('af3-fasta-file').value = '';
            fastaState.message = t('fastaDirectory');
        } catch (error) {
            if (error.name !== 'AbortError') fastaState.saved = false;
            fastaState.error = error.name !== 'AbortError' && !isUserStopError(error);
            fastaState.message = fastaState.error ? error.message : t('fastaStopped');
        }
        finally { fastaState.busy = false; renderFastaSection(); checkSystemStatus(); }
    }

    async function reconcileFastaHistory(found, account) {
        const now = new Date().toISOString();
        const result = { matched: 0, total: 0, unverified: 0 };
        for (const batch of fastaState.manifest.batches) {
            if (batch.account !== account) continue;
            result.total += batch.jobs.length;
            const confirmedBefore = batch.jobs.filter(job => job.importStatus === 'confirmed').length;
            let resolved = 0;
            for (const job of batch.jobs) {
                const matches = found.get(job.name) || [];
                if (!matches.length) continue; // Absence under a filter never proves deletion, failure or completion.
                const attempt = batch.attempts.at(-1);
                const saveSent = Boolean(attempt?.saveClickedAt && attempt.account === account && attempt.result !== 'not_saved');
                let match = matches[0];
                if (matches.length > 1) {
                    // A reused title can also exist from an older run. Keep only records bound to this
                    // run: an already-bound ID, or the single non-draft record modified after its save.
                    // History times have minute precision, so allow a small tolerance before the save.
                    const bound = job.jobId ? matches.filter(item => item.jobId === job.jobId) : [];
                    const evidenceAt = Date.parse(attempt?.saveClickedAt || attempt?.startedAt || job.submittedAt || '');
                    const recent = Number.isFinite(evidenceAt) ? matches.filter(item =>
                        item.status !== 'draft' && Date.parse(item.modified) >= evidenceAt - 10 * 60 * 1000) : [];
                    const candidates = bound.length === 1 ? bound : recent.length === 1 ? recent : [];
                    if (candidates.length !== 1) throw new Error(t('fastaExisting'));
                    match = candidates[0];
                    resolved++;
                }
                // A pending job is confirmed by a draft seen after this run durably sent its save.
                const draftEvidence = saveSent && match.status === 'draft';
                // Or by this run's own confirmed launch of the same name after that save: a launched
                // prediction proves the job existed, which a reused old Completed/Failed title cannot.
                const submitEvidence = saveSent && Boolean(job.submittedAt) && Date.parse(job.submittedAt) >= Date.parse(attempt.saveClickedAt) &&
                    match.status !== 'draft';
                if (job.importStatus !== 'confirmed' && !draftEvidence && !submitEvidence) {
                    result.unverified++; continue;
                }
                if (fastaState.manifest.settings.sequenceFormat === 'protein-lines' && match.status !== 'draft' && !submitEvidence &&
                    (!job.jobId || !match.jobId)) throw new Error(t('fastaIdentity'));
                if (job.jobId && match.jobId && job.jobId !== match.jobId) throw new Error(t('fastaChanged'));
                result.matched++;
                job.importStatus = 'confirmed'; job.importedAt ||= now; job.lastSeenAt = now; job.modified = match.modified;
                job.jobId ||= match.jobId;
                if (match.status !== 'unknown') job.predictionStatus = match.status;
                if (match.status === 'completed') job.completedAt ||= now;
                if (match.status === 'failed') job.failedAt ||= now;
            }
            const confirmed = batch.jobs.filter(job => job.importStatus === 'confirmed').length;
            batch.status = confirmed === batch.jobs.length ? 'imported' : confirmed ? 'partial' : batch.status;
            if (confirmed !== confirmedBefore) {
                addLog(t('fastaLogBatch', { index: batch.index, count: batch.jobs.length, confirmed, resolved,
                    unverified: batch.jobs.length - confirmed, status: batch.status }));
            }
            if (batch.status === 'imported') {
                batch.importedAt ||= now;
                const attempt = batch.attempts.at(-1);
                if (attempt?.saveClickedAt) { attempt.result = 'confirmed'; attempt.verifiedAt = now; }
            }
        }
        await persistFastaManifest();
        return result;
    }

    async function importFastaBatch(checkOnly = false) {
        if (fastaState.busy || isRunning || downloadState.busy || !fastaState.saved || !fastaState.manifest?.generationComplete) return;
        const batch = fastaState.manifest.batches.find(item => item.status !== 'imported');
        if (!checkOnly && (!batch || batch.status !== 'ready' || fastaState.inputChanged)) return;
        fastaState.busy = true; fastaState.stop = false; fastaState.context = null; fastaState.progress = null; fastaState.message = t('fastaChecking');
        let attempt = null, observer = null, nativeError = '', saveSent = false;
        renderFastaSection(); checkSystemStatus();
        try {
            fastaState.context = getFastaContext();
            const { account, selected } = JSON.parse(fastaState.context);
            addLog(checkOnly ? t('fastaLogCheckStart', { account, filters: selected.join(', ') })
                : t('fastaLogImportStart', { index: batch.index, count: batch.jobs.length, account }));
            if (Array.from(document.querySelectorAll('gdm-af-upload-dialog, [role="dialog"], mat-dialog-container, [role="menu"]')).some(downloadVisible)) throw new Error(t('fastaCloseDialog'));
            if (!checkOnly && (selected.length !== 1 || selected[0] !== 'saved draft')) throw new Error(t('fastaNeedDraft'));
            if (!checkOnly && !confirm(t('fastaConfirm', { index: batch.index, count: batch.jobs.length, account }))) return;
            fastaCheck();
            await selectHistoryScanPageSize(fastaState, getFastaContext, 'size', fastaCheck);
            addLog(t('fastaLogPageSize'));
            const before = await readFastaHistory();
            addLog(t('fastaLogScan', { names: before.size, rows: [...before.values()].reduce((sum, list) => sum + list.length, 0) }));
            if (checkOnly) {
                fastaState.message = t('fastaUpdating'); renderFastaSection();
                const result = await reconcileFastaHistory(before, account);
                fastaState.manifest.lastHistoryCheck = { at: new Date().toISOString(), account, filters: selected, ...result };
                await persistFastaManifest();
                fastaState.message = result.total ? t('fastaChecked', result) + (result.unverified ? ' ' + t('fastaCheckUnverified', result) : '') :
                    t(fastaState.manifest.batches.some(item => item.account) ? 'fastaOtherAccount' : 'fastaNoImports');
                addLog(t('fastaLogResult', result));
                return;
            }
            if (batch.jobs.some(job => before.has(job.name))) throw new Error(t('fastaExisting'));
            const json = await readSavedFastaBatch(batch);
            fastaCheck();
            const upload = findButtonByText('Upload JSON');
            if (!upload) throw new Error(t('fastaPreview'));
            upload.click();
            const dialog = await fastaWait(() => {
                const dialogs = Array.from(document.querySelectorAll('gdm-af-upload-dialog')).filter(downloadVisible);
                return dialogs.length === 1 && dialogs[0];
            }, 8000);
            fastaState.dialog = dialog;
            const input = dialog.querySelector('input[type="file"]');
            if (!input || dialog.querySelectorAll('.job').length) throw new Error(t('fastaPreview'));
            attempt = { startedAt: new Date().toISOString(), account, phase: 'validation', saveClickedAt: null, endedAt: null, result: 'pending' };
            batch.account = account; batch.attempts.push(attempt); batch.status = 'validating';
            await persistFastaManifest();
            fastaState.message = t('fastaUploading', { index: batch.index }); renderFastaSection();
            const seen = new Map(Array.from(document.querySelectorAll('mat-snack-bar-container, .mat-mdc-snack-bar-container'), node => [node, downloadText(node)]));
            observer = new MutationObserver(() => {
                for (const node of document.querySelectorAll('mat-snack-bar-container, .mat-mdc-snack-bar-container')) {
                    const text = downloadText(node);
                    if (seen.get(node) === text) continue;
                    seen.set(node, text);
                    if (/failed|\berror\b|too many|quota|unauthenticated/i.test(text)) nativeError = text;
                }
            });
            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
            const transfer = new DataTransfer(); transfer.items.add(new File([json], batch.jsonFile, { type: 'application/JSON' }));
            fastaCheck(); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
            const validatedSave = () => {
                if (nativeError || !dialog.isConnected || dialog.querySelector('.job.error, .job.warning')) throw new Error(t('fastaPreview') + (nativeError ? ' ' + nativeError : ''));
                const jobs = Array.from(dialog.querySelectorAll('.job'));
                if (!jobs.length || jobs.some(job => job.classList.contains('processing'))) return false;
                const names = jobs.map(job => downloadText(job.querySelector('.name')));
                if (jobs.length !== batch.jobs.length || jobs.some(job => !job.classList.contains('ok')) ||
                    new Set(names).size !== names.length || batch.jobs.some(job => !names.includes(job.name))) throw new Error(t('fastaPreview'));
                const text = batch.jobs.length === 1 ? 'Submit job as draft' : `Submit ${batch.jobs.length} jobs as drafts`;
                return Array.from(dialog.querySelectorAll('button')).find(button => downloadText(button) === text && downloadButtonEnabled(button));
            };
            const save = await fastaWait(validatedSave);
            attempt.phase = 'saving_drafts'; attempt.saveClickedAt = new Date().toISOString(); batch.status = 'uncertain';
            await persistFastaManifest();
            fastaCheck();
            if (validatedSave() !== save || !save.isConnected) throw new Error(t('fastaPreview'));
            saveSent = true; save.click(); // Exactly one native draft-save click; never a prediction button.
            addLog(t('fastaLogSaveSent', { index: batch.index }));
            fastaState.message = t('fastaVerifying', { index: batch.index }); renderFastaSection();
            // A successful history refresh cannot settle a still-open save dialog.
            await fastaWait(() => { if (nativeError) throw new Error(nativeError); return !dialog.isConnected; });
            attempt.dialogClosedAt = new Date().toISOString();
            const deadline = Date.now() + FASTA_IMPORT_TIMEOUT;
            do {
                await sleep(300); fastaCheck();
                // The website streams saved drafts into history; use the remaining import budget, not an inner 8-second cutoff.
                const found = await readFastaHistory(deadline);
                await reconcileFastaHistory(found, account);
                if (batch.status === 'imported' && !nativeError) break;
                if (nativeError) throw new Error(nativeError);
            } while (Date.now() < deadline);
            if (batch.status !== 'imported') throw new Error(t('fastaTimeout', { detail: '' }));
            attempt.result = 'confirmed'; fastaState.message = '';
            addLog(t('fastaLogConfirmed', { index: batch.index }));
        } catch (error) {
            fastaState.error = !isUserStopError(error);
            fastaState.message = isUserStopError(error) ? t('fastaStopped') : error.message;
            addLog(t('fastaLogError', { detail: fastaState.message }), 'error');
            if (attempt) {
                attempt.result = saveSent ? 'unconfirmed' : 'not_saved'; attempt.error = fastaState.message;
                if (!saveSent && attempt.saveClickedAt) { attempt.savePreparedAt = attempt.saveClickedAt; attempt.saveClickedAt = null; }
                if (batch.status !== 'imported' && batch.status !== 'partial') batch.status = saveSent ? 'uncertain' : 'ready';
            }
        } finally {
            observer?.disconnect();
            // Close only the upload dialog this operation opened; never click arbitrary dialogs.
            const dialog = fastaState.dialog;
            if (dialog?.isConnected && !saveSent) {
                const cancel = Array.from(dialog.querySelectorAll('button')).find(button => downloadText(button) === 'Cancel');
                if (cancel) cancel.click();
            }
            fastaState.dialog = null;
            if (attempt) {
                attempt.endedAt = new Date().toISOString();
                try { await persistFastaManifest(); } catch (error) { fastaState.error = true; fastaState.message = error.message; }
            }
            fastaState.busy = false; fastaState.context = null; renderFastaSection(); checkSystemStatus();
        }
    }

    function trackedFastaJob(name) {
        const account = normalizeAccountEmail(readAccountEmail());
        const batch = fastaState.manifest?.batches.find(item => item.account === account && item.jobs.some(job => job.name === name));
        return batch?.jobs.find(item => item.name === name);
    }

    async function prepareFastaSubmission(name) {
        if (!trackedFastaJob(name)) return;
        try {
            if (!fastaState.saved) throw new Error(t('fastaSavedError', { detail: '' }));
            await persistFastaManifest();
        } catch (error) { submissionBlockReason = error.message; throw error; }
    }

    async function recordFastaSubmission(name) {
        const job = trackedFastaJob(name);
        if (!job) return;
        if (!fastaState.saved) { submissionBlockReason = t('fastaSavedError', { detail: '' }); throw new Error(submissionBlockReason); }
        job.submittedAt = new Date().toISOString(); job.predictionStatus = 'submitted';
        try { await persistFastaManifest(); }
        catch (error) { submissionBlockReason = error.message; throw error; }
    }

    function renderFastaSection() {
        const section = getUiElement('af3-fasta-section');
        if (!section) return;
        section.querySelectorAll('[data-fasta-i18n]').forEach(node => { node.textContent = t(node.dataset.fastaI18n); });
        const busy = fastaState.busy || isRunning || downloadState.busy;
        for (const id of ['file', 'generate', 'restore', 'import', 'sync']) {
            const node = getUiElement('af3-fasta-' + id);
            if (node) node.disabled = busy || (['import', 'sync'].includes(id) && (!fastaState.saved || !fastaState.manifest?.generationComplete));
        }
        const batch = fastaState.manifest?.batches.find(item => item.status !== 'imported');
        getUiElement('af3-fasta-import').disabled ||= !batch || batch.status !== 'ready' || fastaState.inputChanged;
        const stop = getUiElement('af3-fasta-stop'); stop.hidden = !fastaState.busy; stop.disabled = fastaState.stop;
        showMessageError(getUiElement('af3-fasta-status'), fastaState.error,
            fastaState.message || (fastaState.inputChanged ? t('fastaInputChanged') : fastaState.manifest?.importComplete ? t('fastaFinished') : t('fastaIdle')));
        const progress = getUiElement('af3-fasta-progress');
        progress.hidden = !fastaState.busy; progress.setAttribute('aria-label', t('fastaProgress'));
        if (fastaState.progress) { progress.max = fastaState.progress.max; progress.value = fastaState.progress.value; }
        else progress.removeAttribute('value');
        const summary = getUiElement('af3-fasta-summary');
        summary.textContent = fastaState.manifest ? t('fastaLocal', { folder: fastaState.dir?.name || '', total: fastaState.manifest.summary?.generated || 0,
            imported: fastaState.manifest.summary?.imported || 0, submitted: fastaState.manifest.summary?.submitted || 0,
            completed: fastaState.manifest.summary?.completed || 0, failed: fastaState.manifest.summary?.failed || 0 }) : '';
        const list = getUiElement('af3-fasta-batches'); list.replaceChildren();
        for (const item of fastaState.manifest?.batches || []) {
            const row = document.createElement('p');
            row.textContent = t('fastaBatch', { index: item.index, count: item.jobs.length, status: t(item.status === 'imported' ? 'fastaImported' : item.status === 'ready' ? 'fastaReady' : 'fastaUncertain') });
            list.appendChild(row);
        }
    }

    function createFastaSection() {
        const section = document.createElement('section'); section.id = 'af3-fasta-section'; section.className = 'af3-card';
        const text = (tag, key) => { const node = document.createElement(tag); node.dataset.fastaI18n = key; node.textContent = t(key); return node; };
        const title = text('h2', 'fastaTitle'); title.id = 'af3-fasta-title'; section.setAttribute('aria-labelledby', title.id); section.appendChild(title);
        const help = text('p', 'fastaHelp'); help.className = 'af3-help'; section.appendChild(help);
        const field = (id, key, node) => { const label = document.createElement('label'); label.className = 'af3-field'; label.append(text('span', key), node); node.id = 'af3-fasta-' + id; section.appendChild(label); };
        const file = document.createElement('input'); file.type = 'file'; file.accept = '.fasta,.fa,.faa,text/plain'; field('file', 'fastaFile', file);
        file.onchange = () => {
            if (fastaState.busy) return;
            if (fastaState.error) { fastaState.error = false; fastaState.message = ''; }
            if (fastaState.manifest) { fastaState.inputChanged = true; fastaState.message = t('fastaInputChanged'); }
            renderFastaSection();
        };
        const tools = document.createElement('div'); tools.className = 'af3-download-tools';
        for (const [id, key, action] of [['generate', 'fastaGenerate', generateFastaBatches], ['restore', 'fastaRestore', restoreFastaBatches],
            ['import', 'fastaImport', () => importFastaBatch()], ['sync', 'fastaSync', () => importFastaBatch(true)],
            ['stop', 'fastaStop', () => { fastaState.stop = true; renderFastaSection(); }]]) {
            const button = text('button', key); button.id = 'af3-fasta-' + id; button.type = 'button';
            button.onclick = () => {
                if (id !== 'stop') { fastaState.error = false; showMessageError(getUiElement('af3-fasta-status'), false); }
                return action();
            };
            if (id === 'import') button.className = 'af3-primary';
            tools.appendChild(button);
        }
        const status = document.createElement('p'); status.id = 'af3-fasta-status'; status.className = 'af3-help'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        const progress = document.createElement('progress'); progress.id = 'af3-fasta-progress'; progress.hidden = true; progress.setAttribute('aria-describedby', status.id);
        const summary = document.createElement('p'); summary.id = 'af3-fasta-summary'; summary.className = 'af3-help';
        const list = document.createElement('div'); list.id = 'af3-fasta-batches'; list.className = 'af3-help'; list.style.cssText = 'max-height:160px;overflow:auto';
        section.append(tools, status, progress, summary, list);
        return section;
    }

    let isRunning = false;
    let shouldStop = false;
    let isPaused = false;
    // Keep this guard after a batch ends. Re-enabling the UI is not evidence
    // that a request was rejected; the user must reconcile it before reloading.
    let submissionBlockReason = '';
    let isDraggingPanel = false;
    let isResizingPanel = false;
    let panelSize = null;
    let activePage = 'tasks';
    let editingAccount = '';
    let accountMessage = '';
    let accountStorageError = false;
    let accountRecords = loadAccounts();
    let accountRenderSignature = '';
    let observedAccountEmail;
    let hasObservedAccount = false;
    let accountQuotaBinding = null;
    let accountLiveQuota = null;
    let batchAccountEmail = null;
    const downloadState = {
        busy: false, stop: false, complete: false, jobs: [], selected: new Set(),
        unknown: 0, context: null, scanContext: null, message: '', messageVars: {}, phase: '',
        watchNative: false, nativeMutation: false, selectionChanged: false,
        format: getSavedDownloadFormat(), queue: null, controller: null,
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
            const saved = localStorage.getItem(LANGUAGE_KEY) || localStorage.getItem('af3-v20-panel-language');
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
        const header = getUiElement('af3-header-title');
        const languageSelect = getUiElement('af3-language-select');
        const input = getUiElement('af3-v20-count');
        const footer = getUiElement('af3-footer-msg');
        const statusText = getUiElement('af3-status-text');

        if (header) header.textContent = t('headerTitle');
        const countLabel = getUiElement('af3-count-label');
        if (countLabel) countLabel.textContent = t('batchCount');
        const panel = getUiElement(PANEL_ROOT_ID);
        if (panel) panel.lang = currentLanguage;
        const submitTitle = getUiElement('af3-submission-title');
        if (submitTitle) submitTitle.textContent = t('submitTitle');
        if (languageSelect) {
            languageSelect.value = currentLanguage;
            languageSelect.title = t('languageTitle');
            languageSelect.setAttribute('aria-label', t('languageTitle'));
        }
        if (input) input.title = t('confirmPlan', { count: input.value || 0 });
        const resizeHandle = getUiElement('af3-resize-handle');
        if (resizeHandle) {
            resizeHandle.title = t('resizePanel');
            resizeHandle.setAttribute('aria-label', t('resizePanel'));
        }
        updateQuota();
        updateAccountEmail();
        renderAccountManager(true);
        renderPanelPages();
        renderDownloadSection();
        renderFastaSection();
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

    function showMessageError(node, error, text = node?.textContent) {
        if (!node) return;
        const highlighted = node.classList.contains('af3-error-message');
        const changed = node.textContent !== text;
        if (highlighted !== error) {
            node.setAttribute('role', error ? 'alert' : 'status');
            node.setAttribute('aria-live', error ? 'assertive' : 'polite');
        }
        if (changed) node.textContent = text;
        if (error && (!highlighted || changed)) {
            node.classList.remove('af3-error-message');
            void node.offsetWidth; // ponytail: restart CSS on a new error, not on periodic renders.
            node.classList.add('af3-error-message');
            if (node.getClientRects().length) node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        } else if (!error && highlighted) node.classList.remove('af3-error-message');
    }

    function getSavedPanelPosition() {
        try {
            const raw = localStorage.getItem(PANEL_POSITION_KEY) || localStorage.getItem('af3-v20-panel-position');
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
        return panelSize = { width: 392, height: 800 };
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

    function readAccountEmail() {
        const emailPattern = /[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/gi;
        const fromText = value => [...String(value || '').matchAll(emailPattern)].map(match => match[0]);
        // Only read account controls, never task names or arbitrary page text.
        const profiles = Array.from(document.querySelectorAll('gdm-af-user-menu, [aria-label*="Google Account"], [aria-label*="Google 账号"], [aria-label*="Google 帐号"]')).filter(downloadVisible);
        const emails = new Set();
        for (const profile of profiles) {
            const nodes = [profile, ...profile.querySelectorAll('[aria-label], [title], img[alt]')].filter(downloadVisible);
            for (const node of nodes) {
                for (const attr of ['aria-label', 'title', 'alt']) fromText(node.getAttribute(attr)).forEach(email => emails.add(email));
            }
            const walker = document.createTreeWalker(profile, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                const parent = walker.currentNode.parentElement;
                if (downloadVisible(parent) && !parent.closest('script, style')) fromText(walker.currentNode.textContent).forEach(email => emails.add(email));
            }
        }
        if (emails.size) return emails.size === 1 ? [...emails][0] : null;

        // The site's GAIA user reads this email from its own bootstrap data.
        // Inspect that one value; no cookies, auth tokens, requests, or storage.
        let data = window.WIZ_global_data;
        if (!data) {
            const script = document.querySelector('script[data-id="_gd"]');
            const json = script?.textContent.match(/(?:window\.)?WIZ_global_data\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)?.[1];
            if (json) { try { data = JSON.parse(json); } catch (_) {} }
        }
        const email = typeof data?.oPEP7c === 'string' ? data.oPEP7c.trim() : '';
        return email && fromText(email).length === 1 && fromText(email)[0] === email ? email : null;
    }

    function updateAccountEmail() {
        const target = getUiElement('af3-account-email');
        if (!target) return;
        const email = readAccountEmail();
        const message = email ? t('accountEmail', { email }) : t('accountUnknown');
        if (target.textContent !== message) target.textContent = message;
        if (target.title !== message) target.title = message;
        syncAccountManager(normalizeAccountEmail(email));
    }

    function normalizeAccountEmail(value) {
        const email = typeof value === 'string' ? value.trim() : '';
        return email.length <= 254 && /^[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(email) ? email.toLowerCase() : '';
    }

    function parseAccountRecords(value) {
        const data = typeof value === 'string' ? JSON.parse(value) : value;
        if (data?.version !== 1 || !Array.isArray(data.accounts)) throw new Error('Invalid account records');
        const records = new Map();
        for (const item of data.accounts) {
            const email = normalizeAccountEmail(item?.email);
            if (!email) continue;
            const quota = item.quota;
            records.set(email, {
                email, note: typeof item.note === 'string' ? item.note.slice(0, 200) : '',
                quota: Number.isSafeInteger(quota?.remaining) && quota.remaining >= 0 &&
                    Number.isSafeInteger(quota.observedAt) && quota.observedAt > 0 && quota.observedAt <= Date.now() + 60000
                    ? { remaining: quota.remaining, observedAt: quota.observedAt } : null,
            });
        }
        return [...records.values()];
    }

    function readLegacyAccounts() {
        try {
            const raw = localStorage.getItem(ACCOUNTS_KEY);
            return raw ? { found: true, records: parseAccountRecords(raw) } : { found: false, records: [] };
        } catch (_) {
            try {
                if (localStorage.getItem(ACCOUNTS_KEY)) return { found: true, invalid: true, records: [] };
            } catch (_) {}
            return { found: false, unavailable: true, records: [] };
        }
    }

    function mergeAccountRecords(current, imported) {
        const records = new Map(current.map(item => [item.email, item]));
        for (const item of imported) {
            const existing = records.get(item.email);
            if (!existing) {
                records.set(item.email, item);
                continue;
            }
            const quota = (existing.quota?.observedAt || 0) >= (item.quota?.observedAt || 0)
                ? existing.quota : item.quota;
            records.set(item.email, { ...existing, note: existing.note || item.note, quota });
        }
        return [...records.values()];
    }

    function clearLegacyAccounts() {
        try { localStorage.removeItem(ACCOUNTS_KEY); } catch (_) {}
    }

    function loadAccounts() {
        try {
            if (typeof GM_getValue === 'function' && typeof GM_setValue === 'function') {
                const stored = GM_getValue(ACCOUNTS_KEY, null);
                const hasSharedRecords = stored !== null;
                const current = hasSharedRecords ? parseAccountRecords(stored) : [];
                const legacy = readLegacyAccounts();
                if (legacy.invalid && !hasSharedRecords) throw new Error('Invalid legacy account records');
                let records = current;
                if (legacy.found && !legacy.invalid) {
                    records = mergeAccountRecords(current, legacy.records);
                    if (!hasSharedRecords || records.length !== current.length ||
                        JSON.stringify(records) !== JSON.stringify(current)) {
                        GM_setValue(ACCOUNTS_KEY, { version: 1, accounts: records });
                    }
                    clearLegacyAccounts();
                }
                accountStorageError = false;
                return records;
            }
            const raw = localStorage.getItem(ACCOUNTS_KEY);
            accountStorageError = false;
            return raw ? parseAccountRecords(raw) : [];
        } catch (_) { accountStorageError = true; return []; }
    }

    function changeAccountRecord(email, change) {
        // Read the latest records before each write so tabs preserve each other's edits.
        const latest = accountStorageError ? [...accountRecords] : loadAccounts();
        const records = accountStorageError ? [...accountRecords] : latest;
        const index = records.findIndex(item => item.email === email);
        const result = change(index < 0 ? null : records[index]);
        if (result) {
            if (index < 0) records.push(result); else records[index] = result;
        } else if (index >= 0) records.splice(index, 1);
        accountRecords = records;
        if (!accountStorageError) {
            try {
                if (typeof GM_setValue === 'function' && typeof GM_getValue === 'function') {
                    GM_setValue(ACCOUNTS_KEY, { version: 1, accounts: records });
                    clearLegacyAccounts();
                } else {
                    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify({ version: 1, accounts: records }));
                }
            } catch (_) { accountStorageError = true; }
        }
        renderAccountManager();
    }

    function syncAccountManager(email, force = false) {
        const sources = Array.from(document.querySelectorAll('gdm-af-request .points')).filter(downloadVisible);
        const node = sources.length === 1 ? sources[0] : null;
        const text = node?.textContent || '';
        if (email !== observedAccountEmail) {
            const previous = accountQuotaBinding;
            const changed = observedAccountEmail !== undefined;
            observedAccountEmail = email;
            // A profile may change before the old quota DOM disappears. Wait for a
            // new node/value before associating that quota with another account.
            accountQuotaBinding = {
                node: previous?.node || node, text: previous?.text ?? text,
                ready: Boolean(email && (!hasObservedAccount || node !== previous?.node || text !== previous?.text)),
            };
            if (email) {
                hasObservedAccount = true;
                if (!accountRecords.some(item => item.email === email)) {
                    changeAccountRecord(email, () => ({ email, note: '', quota: null }));
                }
            }
            if (changed) {
                downloadState.stop = downloadState.busy;
                downloadState.complete = false;
                downloadState.jobs = [];
                downloadState.selected.clear();
                downloadState.queue = null;
                if (isRunning && batchAccountEmail && email !== batchAccountEmail) {
                    submissionBlockReason = t('accountChanged');
                    requestStop();
                }
                renderDownloadSection();
            }
        }
        if (email && !accountQuotaBinding.ready &&
            (node !== accountQuotaBinding.node || text !== accountQuotaBinding.text)) accountQuotaBinding.ready = true;
        accountLiveQuota = email && accountQuotaBinding?.ready ? readQuota(node) : null;
        if (accountQuotaBinding?.ready) Object.assign(accountQuotaBinding, { node, text });
        const record = accountRecords.find(item => item.email === email);
        // Preview values stay on the Jobs page; records only use the request page.
        if (record && accountLiveQuota !== null && (force || !record.quota ||
            record.quota.remaining !== accountLiveQuota || Date.now() - record.quota.observedAt >= 60000)) {
            const quota = { remaining: accountLiveQuota, observedAt: Date.now() };
            changeAccountRecord(email, existing => ({ ...(existing || { email, note: '' }), quota }));
        }
        renderAccountManager();
    }

    function renderPanelPages() {
        for (const page of ['tasks', 'accounts']) {
            const selected = activePage === page;
            const tab = getUiElement(`af3-${page}-tab`);
            const panel = getUiElement(`af3-${page}-page`);
            if (tab) {
                tab.textContent = t(page === 'tasks' ? 'tasksPage' : 'accountsPage');
                tab.setAttribute('aria-selected', String(selected));
                tab.tabIndex = selected ? 0 : -1;
            }
            if (panel) panel.hidden = !selected;
        }
    }

    function openAccountSwitch() {
        showMessageError(getUiElement('af3-accounts-message'), false);
        if (isRunning || downloadState.busy || fastaState.busy) {
            updateAccountSwitchControl();
            return;
        }
        try {
            if (typeof GM_openInTab !== 'function') throw new Error('InPrivate tab API unavailable');
            const tab = GM_openInTab('https://alphafoldserver.com/', { active: true, incognito: true });
            if (!tab) throw new Error('InPrivate tab was not created');
            accountMessage = 'accountPrivateOpened';
        } catch (_) {
            accountMessage = 'accountPrivateUnavailable';
        }
        renderAccountManager();
    }

    function updateAccountSwitchControl() {
        const login = getUiElement('af3-account-login');
        if (!login) return;
        const busy = isRunning || downloadState.busy || fastaState.busy;
        login.disabled = busy;
        login.setAttribute('aria-disabled', String(busy));
        login.tabIndex = busy ? -1 : 0;
        login.title = t(busy ? 'accountSwitchBusy' : 'accountLoginHelp');
        getUiElement('af3-account-login-help').textContent = t(busy ? 'accountSwitchBusy' : 'accountLoginHelp');
    }

    function renderAccountManager(force = false) {
        const list = getUiElement('af3-accounts-list');
        if (!list) return;
        for (const [id, key] of [['accounts-title', 'accountsPage'], ['accounts-intro', 'accountsIntro'],
            ['account-email-label', 'accountEmailLabel'], ['account-note-label', 'accountNoteLabel'],
            ['account-cancel', 'accountCancel'], ['account-refresh', 'accountRefresh'], ['account-login', 'accountLogin'],
            ['account-login-help', 'accountLoginHelp']]) getUiElement(`af3-${id}`).textContent = t(key);
        getUiElement('af3-account-save').textContent = t(editingAccount ? 'accountSave' : 'accountAdd');
        getUiElement('af3-account-cancel').hidden = !editingAccount;
        getUiElement('af3-account-refresh').disabled = !observedAccountEmail || accountLiveQuota === null;
        updateAccountSwitchControl();
        getUiElement('af3-accounts-count').textContent = t('accountsCount', { count: accountRecords.length });
        showMessageError(getUiElement('af3-accounts-message'), accountStorageError || ['accountInvalid', 'accountReadFailed', 'accountPrivateUnavailable'].includes(accountMessage),
            accountStorageError ? t('accountStorageError') : accountMessage ? t(accountMessage) : '');
        const signature = JSON.stringify([currentLanguage, observedAccountEmail, accountLiveQuota, accountRecords]);
        if (!force && signature === accountRenderSignature) return;
        accountRenderSignature = signature;
        list.replaceChildren();
        if (!accountRecords.length) {
            const empty = document.createElement('p'); empty.textContent = t('accountsEmpty'); list.append(empty);
        }
        const records = [...accountRecords].sort((a, b) => Number(b.email === observedAccountEmail) - Number(a.email === observedAccountEmail));
        for (const record of records) {
            const card = document.createElement('article'); card.className = 'af3-account-card'; card.dataset.email = record.email;
            const email = document.createElement('strong'); email.textContent = record.email; card.append(email);
            if (record.email === observedAccountEmail) {
                const current = document.createElement('span'); current.className = 'af3-account-current'; current.textContent = t('accountCurrent'); card.append(current);
            }
            if (record.note) { const note = document.createElement('p'); note.textContent = record.note; card.append(note); }
            const quota = document.createElement('p');
            const live = record.email === observedAccountEmail && accountLiveQuota !== null;
            quota.textContent = t(live ? 'accountLiveQuota' : record.quota ? 'accountSavedQuota' : 'accountNoQuota', { count: live ? accountLiveQuota : record.quota?.remaining });
            quota.className = live ? 'af3-account-live' : 'af3-account-history'; card.append(quota);
            if (record.quota) {
                const time = document.createElement('time'); time.dateTime = new Date(record.quota.observedAt).toISOString();
                time.textContent = t('accountRecordedAt', { time: new Date(record.quota.observedAt).toLocaleString(currentLanguage, { hour12: false }) }); card.append(time);
            }
            const actions = document.createElement('div'); actions.className = 'af3-account-actions';
            const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = t('accountEdit'); edit.dataset.action = 'edit';
            edit.onclick = () => {
                editingAccount = record.email;
                getUiElement('af3-account-input').value = record.email;
                getUiElement('af3-account-input').readOnly = true;
                getUiElement('af3-account-note').value = record.note;
                getUiElement('af3-account-note').focus(); renderAccountManager();
            };
            const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = t('accountRemove'); remove.dataset.action = 'remove';
            remove.onclick = () => {
                if (!confirm(t('accountRemoveConfirm', { email: record.email }))) return;
                if (editingAccount === record.email) resetAccountForm();
                accountMessage = 'accountRemoved';
                changeAccountRecord(record.email, () => null);
            };
            actions.append(edit, remove); card.append(actions); list.append(card);
        }
    }

    function resetAccountForm() {
        editingAccount = '';
        getUiElement('af3-account-form').reset();
        getUiElement('af3-account-input').readOnly = false;
        renderAccountManager();
    }

    function createAccountPage() {
        const page = document.createElement('section'); page.id = 'af3-accounts-page'; page.className = 'af3-page';
        page.setAttribute('role', 'tabpanel'); page.setAttribute('aria-labelledby', 'af3-accounts-tab'); page.hidden = true;
        // The real website enforces Trusted Types. Build the panel with DOM
        // nodes so creating it never requires an HTML string or a site policy.
        const append = (parent, tag, id, attributes = {}) => {
            const node = document.createElement(tag);
            if (id) node.id = `af3-${id}`;
            for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
            parent.appendChild(node);
            return node;
        };
        const overview = append(page, 'div', '', { class: 'af3-card' });
        append(overview, 'h2', 'accounts-title');
        append(overview, 'p', 'accounts-intro', { class: 'af3-account-help' });
        const actions = append(overview, 'div', '', { class: 'af3-account-actions' });
        append(actions, 'button', 'account-refresh', { type: 'button' });
        append(actions, 'button', 'account-login', { type: 'button' });
        append(overview, 'p', 'account-login-help', { class: 'af3-account-help' });
        append(page, 'p', 'accounts-message', { role: 'status', 'aria-live': 'polite' });
        append(page, 'h3', 'accounts-count');
        append(page, 'div', 'accounts-list');
        const form = append(page, 'form', 'account-form', { novalidate: '', class: 'af3-card' });
        append(form, 'label', 'account-email-label', { for: 'af3-account-input' });
        append(form, 'input', 'account-input', { type: 'email', maxlength: '254', autocomplete: 'off', required: '' });
        append(form, 'label', 'account-note-label', { for: 'af3-account-note' });
        append(form, 'input', 'account-note', { type: 'text', maxlength: '200', autocomplete: 'off' });
        const formActions = append(form, 'div', '', { class: 'af3-account-actions' });
        append(formActions, 'button', 'account-save', { type: 'submit', class: 'af3-primary' });
        append(formActions, 'button', 'account-cancel', { type: 'button', hidden: '' });
        const login = page.querySelector('#af3-account-login');
        login.onclick = openAccountSwitch;
        page.querySelector('#af3-account-form').onsubmit = event => {
            event.preventDefault();
            showMessageError(getUiElement('af3-accounts-message'), false);
            const email = normalizeAccountEmail(getUiElement('af3-account-input').value);
            if (!email) { accountMessage = 'accountInvalid'; renderAccountManager(); return; }
            const note = getUiElement('af3-account-note').value.trim().slice(0, 200);
            accountMessage = 'accountSaved';
            changeAccountRecord(email, existing => ({ email, note, quota: existing?.quota || null }));
            resetAccountForm();
        };
        page.querySelector('#af3-account-cancel').onclick = resetAccountForm;
        page.querySelector('#af3-account-refresh').onclick = () => {
            showMessageError(getUiElement('af3-accounts-message'), false);
            const email = normalizeAccountEmail(readAccountEmail());
            syncAccountManager(email, true);
            if (email && accountLiveQuota !== null) {
                // Also restores a current account record the user previously removed.
                changeAccountRecord(email, existing => ({ email, note: existing?.note || '', quota: { remaining: accountLiveQuota, observedAt: Date.now() } }));
                accountMessage = 'accountUpdated';
            } else accountMessage = 'accountReadFailed';
            renderAccountManager();
        };
        return page;
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
        if (logEntries.length > 120) logEntries.shift();

        const consoleFn = level === 'warn' ? console.warn : level === 'error' ? console.error : console.log;
        consoleFn(`[AF3] ${message}`);
        renderLogPanel();
    }

    function startRunProgress(total) {
        showMessageError(getUiElement('af3-footer-msg'), false);
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
        runProgress.status = status; runProgress.detail = detail;
        checkSystemStatus();

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

        if (toggle) {
            toggle.textContent = `${t('logLabel')} (${logEntries.length})`;
            toggle.setAttribute('aria-expanded', String(logExpanded));
        }
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

    function checkBatchAccount() {
        if (isRunning && batchAccountEmail && normalizeAccountEmail(readAccountEmail()) !== batchAccountEmail) {
            submissionBlockReason = t('accountChanged');
            shouldStop = true;
            throw makeStoppedError();
        }
    }

    function checkStop() {
        checkBatchAccount();
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
        // ponytail: submitted drafts refill this page; Failed only processes its current rows.
        const plannedJobs = currentMode === 'DRAFT' ? maxJobs : Math.min(maxJobs, rowCount);

        if (rowCount === 0) {
            showMessageError(getUiElement('af3-footer-msg'), false);
            runProgress.status = 'error'; runProgress.detail = t('noRowsAlert');
            checkSystemStatus();
            alert(runProgress.detail);
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
    async function submitAndConfirm(confirmButton, trackedName = null) {
        await waitIfPaused();
        if (trackedName) await prepareFastaSubmission(trackedName);
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
                    checkBatchAccount();
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
        // A loading table may be empty before its remaining drafts refill the page.
        const history = document.querySelector('gdm-af-history') || document;
        while (downloadHistoryLoading(history) || getRows().some(row => getDraftIdentity(row) === identity)) {
            if (Date.now() >= deadline) {
                submissionBlockReason = t('draftListUnchanged');
                throw new Error(submissionBlockReason);
            }
            await sleep(100);
        }
        // A confirmed request still needs its row refresh after Stop; never unlock an unchanged draft.
        checkStop();
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

        // ponytail: omit optional view; userscript Window proxies fail native type checks.
        const opts = { bubbles: true, cancelable: true, buttons: 1 };
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

    async function selectHistoryScanPageSize(state, getContext, sizeKey, checkActive) {
        checkActive();
        const { root } = getDownloadHistory(true);
        const paginators = Array.from(root.querySelectorAll('mat-paginator')).filter(downloadVisible);
        if (!paginators.length) return; // Unpaginated lists need no page-size change.
        if (paginators.length !== 1) throw new Error(t('historyScanSizeError'));
        const paginator = paginators[0];
        const controls = Array.from(paginator.querySelectorAll('select, mat-select')).filter(downloadVisible);
        if (controls.length !== 1) throw new Error(t('historyScanSizeError'));
        const control = controls[0], before = state.context, context = JSON.parse(before);
        if (context[sizeKey] === '100') return;
        if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error(t('historyScanSizeError'));
        let selected = false, seenSize = false, opened = false, panel = null, panelId = '';
        const verify = () => {
            // Only our pending size change may differ; never recapture account/filter/sort snapshots.
            if (selected && !seenSize && JSON.parse(getContext())[sizeKey] === context[sizeKey]) {
                state.context = before;
                try { checkActive(); } finally { state.context = JSON.stringify({ ...context, [sizeKey]: '100' }); }
            } else checkActive();
            if (!downloadVisible(control) || !paginator.contains(control)) throw new Error(t('historyScanSizeError'));
        };
        const expectSize = () => {
            checkActive();
            selected = true;
            state.context = JSON.stringify({ ...context, [sizeKey]: '100' });
        };
        try {
            if (control.tagName === 'SELECT') {
                const options = Array.from(control.options).filter(option =>
                    !option.disabled && !option.parentElement?.disabled && (option.value === '100' || downloadText(option) === '100'));
                if (options.length !== 1) throw new Error(t('historyScanSizeError'));
                expectSize();
                control.value = options[0].value;
                control.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                if (control.getAttribute('aria-expanded') === 'true') throw new Error(t('downloadMenuBusy'));
                opened = true; control.click();
                const deadline = Date.now() + 8000;
                while (Date.now() < deadline) {
                    const ids = [...new Set([control.getAttribute('aria-controls'), control.getAttribute('aria-owns')].filter(Boolean).flatMap(id => id.split(/\s+/)))];
                    if (ids.length > 1 || (panelId && ids[0] !== panelId)) throw new Error(t('historyScanSizeError'));
                    if (ids.length === 1) {
                        panelId = ids[0];
                        const current = document.getElementById(panelId);
                        if (panel && current !== panel) throw new Error(t('historyScanSizeError'));
                        panel = current;
                    }
                    verify();
                    if (panel && downloadVisible(panel)) {
                        if (panel.getAttribute('role') !== 'listbox') throw new Error(t('historyScanSizeError'));
                        const options = Array.from(panel.querySelectorAll('mat-option, [role="option"]')).filter(node =>
                            downloadVisible(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true' && downloadText(node) === '100');
                        if (options.length !== 1) throw new Error(t('historyScanSizeError'));
                        expectSize(); options[0].click(); break;
                    }
                    await sleep(50);
                }
                if (!selected) throw new Error(t('historyScanSizeError'));
            }
            const deadline = Date.now() + 8000;
            let stable = '', since = 0;
            while (Date.now() < deadline) {
                verify();
                seenSize ||= JSON.parse(getContext())[sizeKey] === '100';
                const history = getDownloadHistory(true);
                if (seenSize && !downloadHistoryLoading(history.root, true) && (!panel || !downloadVisible(panel))) {
                    const page = readDownloadPage();
                    const range = /^(\d[\d,]*)\s*[–-]\s*(\d[\d,]*)\s+of\s+(\d[\d,]*)$/i.exec(page.range);
                    const [first, last, total] = range ? range.slice(1).map(value => Number(value.replace(/,/g, ''))) : [];
                    const ready = range ? (first - 1) % 100 === 0 && last === Math.min(first + 99, total) && page.jobs.length === last - first + 1 : /^0\s+of\s+0$/i.test(page.range) && !page.jobs.length;
                    if (ready) {
                        if (stable === page.signature && Date.now() - since >= 200) return;
                        if (stable !== page.signature) { stable = page.signature; since = Date.now(); }
                    } else stable = '';
                } else stable = '';
                await sleep(50);
            }
            throw new Error(t('historyScanSizeError'));
        } finally {
            if (opened && control.isConnected && control.getAttribute('aria-expanded') === 'true') {
                const ids = [control.getAttribute('aria-controls'), control.getAttribute('aria-owns')].filter(Boolean);
                if ((!panelId && !ids.length) || (ids.includes(panelId) && document.getElementById(panelId) === panel)) {
                    // Escape closes only our select, including an opening panel after Stop.
                    (panel || control).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
                }
            }
        }
    }

    function downloadHistoryLoading(root = document, ignoreJobStatus = false) {
        return Array.from(root.querySelectorAll('mat-spinner, mat-progress-bar, mat-progress-spinner, [aria-busy="true"]')).some(node =>
            downloadVisible(node) && (!ignoreJobStatus || !node.closest('.mat-column-status, .cdk-column-status'))) ||
            // Material renders blank name/date cells during pagination without a spinner.
            Array.from(root.querySelectorAll('tr.mat-mdc-row, tr[mat-row]')).some(row => {
                const name = row.querySelector('.mat-column-name, .cdk-column-name'), date = row.querySelector('.mat-column-date, .cdk-column-date');
                return downloadVisible(row) && name && date && !downloadText(name) && !downloadText(date);
            });
    }

    function getDownloadHistory(allowLoading = false) {
        const histories = Array.from(document.querySelectorAll('table')).filter(downloadVisible).map(table => {
            const headers = Array.from(table.querySelectorAll('thead th, tr th, [role="columnheader"]'));
            const labels = headers.map(downloadText);
            return { table, root: table.closest('gdm-af-history') || document, nameIndex: labels.indexOf('Name'), dateIndex: labels.indexOf('Modified') };
        }).filter(history => history.nameIndex >= 0 && history.dateIndex >= 0);
        if (!histories.length) {
            const empty = Array.from(document.querySelectorAll('gdm-af-history')).filter(downloadVisible).filter(root =>
                Array.from(root.querySelectorAll('.no-results, .loading')).some(node => downloadVisible(node) &&
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
        return JSON.stringify({ url: location.href, account: normalizeAccountEmail(readAccountEmail()), selected, search: search?.value || '', sort, pageSize: pageSize?.tagName === 'SELECT' ? (/^\d+$/.test(pageSize.value) ? pageSize.value : downloadText(pageSize.selectedOptions[0])) : downloadText(pageSize) || (loading ? previous?.pageSize || '' : '') });
    }

    function checkDownloadActive() {
        if (downloadState.stop) throw makeStoppedError();
        if (downloadState.selectionChanged) throw new Error(t('downloadNativeChanged'));
        if (downloadState.context !== getDownloadContext()) throw new Error(t('downloadContextChanged'));
    }

    async function downloadDelay(ms, checkActive = checkDownloadActive) {
        const until = Date.now() + ms;
        do {
            checkActive();
            await sleep(Math.min(60, Math.max(0, until - Date.now())));
        } while (Date.now() < until);
        checkActive();
    }

    function readDownloadIdentity(root) {
        const ids = new Set();
        const declaredId = root.getAttribute('data-job-id');
        if (declaredId) ids.add(declaredId);
        for (const anchor of root.querySelectorAll('a[href]')) {
            let url, linkId;
            try {
                url = new URL(anchor.getAttribute('href'), document.baseURI);
                const path = /^\/(?:job|jobs|fold)\/([^/]+)(?:\/\d+)?\/?$/.exec(url.pathname);
                if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin || url.username || url.password || !path) continue;
                linkId = decodeURIComponent(path[1]);
            } catch (_) { continue; }
            if (!linkId || /[\\/\s?#\x00-\x1f\x7f]/.test(linkId)) continue;
            ids.add(linkId);
        }
        if (ids.size > 1) throw new Error(t('downloadIdentityConflict'));
        return ids.values().next().value;
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
            const id = readDownloadIdentity(row);
            if (!name) throw new Error(t('downloadNoHistory'));
            return { key: id ? `id:${id}` : `row:${JSON.stringify([name, modified])}`, id: Boolean(id), name, modified, day, row };
        });
        const paginators = Array.from(root.querySelectorAll('mat-paginator')).filter(downloadVisible);
        if (paginators.length > 1) throw new Error(t('downloadPageError'));
        const paginator = paginators[0] || null;
        const control = (className, label) => paginator?.querySelector(`button.${className}, button[aria-label="${label}"]`) || null;
        const first = control('mat-mdc-paginator-navigation-first', 'First page');
        const previous = control('mat-mdc-paginator-navigation-previous', 'Previous page');
        const next = control('mat-mdc-paginator-navigation-next', 'Next page');
        if (paginator && (!previous || !next)) throw new Error(t('downloadPageError'));
        const range = paginator?.querySelector('.mat-mdc-paginator-range-label')?.textContent?.trim() || '';
        return { jobs, first, previous, next, range, signature: JSON.stringify([range, jobs.map(job => [job.key, job.modified])]) };
    }

    async function readDownloadMenuIdentity(row, resultJob = null, checkActive = checkDownloadActive) {
        const triggers = row.querySelectorAll('td.mat-column-options button.fold-actions[aria-haspopup="menu"]');
        if (!triggers.length) return null;
        if (triggers.length !== 1) throw new Error(t('downloadMenuIdentity'));
        const trigger = triggers[0];
        const visibleMenus = () => Array.from(document.querySelectorAll('[role="menu"]')).filter(downloadVisible);
        if (trigger.getAttribute('aria-expanded') === 'true' || visibleMenus().length ||
            Array.from(document.querySelectorAll('[role="dialog"], mat-dialog-container')).some(downloadVisible)) throw new Error(t('downloadMenuBusy'));
        if (!downloadButtonEnabled(trigger) || trigger.querySelector('mat-icon')?.textContent.trim() !== 'more_vert') throw new Error(t('downloadMenuIdentity'));
        let panel = null, panelId = null, pendingPanel = null;
        const capturePanel = () => {
            const menus = visibleMenus();
            if (!pendingPanel && menus.length === 1) pendingPanel = menus[0];
            const id = trigger.getAttribute('aria-controls');
            if (id && !panelId) panelId = id;
            if (panelId && !panel) panel = document.getElementById(panelId);
            return id;
        };
        const associated = () => row.contains(trigger) && trigger.getAttribute('aria-expanded') === 'true' &&
            trigger.getAttribute('aria-controls') === panelId && document.getElementById(panelId) === panel &&
            !Array.from(document.querySelectorAll('button[aria-controls]')).some(button => button !== trigger &&
                button.getAttribute('aria-expanded') === 'true' && button.getAttribute('aria-controls') === panelId);
        try {
            checkActive();
            trigger.click();
            const deadline = Date.now() + 2500;
            while (Date.now() < deadline) {
                const id = capturePanel();
                checkActive();
                if (!downloadVisible(row) || !trigger.isConnected || (panelId && id !== panelId) ||
                    (pendingPanel && (!pendingPanel.isConnected || (panel && pendingPanel !== panel))) ||
                    (panel && (!associated() || panel.getAttribute('role') !== 'menu' || visibleMenus().some(menu => menu !== panel))) ||
                    visibleMenus().length > 1) throw new Error(t('downloadMenuIdentity'));
                if (panel && downloadVisible(panel)) {
                    const jobId = readDownloadIdentity(panel);
                    if (jobId) {
                        if (!resultJob) return jobId;
                        if (`id:${jobId}` !== resultJob.key) throw new Error(t('downloadMissing'));
                        const links = Array.from(panel.querySelectorAll('a[href]')).filter(link =>
                            downloadVisible(link) && downloadText(link) === 'Download' && link.getAttribute('aria-disabled') !== 'true');
                        if (links.length !== 1) throw new Error(t('downloadSaveLink'));
                        let url;
                        try { url = new URL(links[0].getAttribute('href'), document.baseURI); }
                        catch (_) { throw new Error(t('downloadSaveLink')); }
                        if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin || url.username || url.password || url.hash) throw new Error(t('downloadSaveLink'));
                        return url.href;
                    }
                }
                await downloadDelay(30, checkActive);
            }
            throw new Error(t('downloadMenuIdentity'));
        } finally {
            // Material can attach the panel before updating aria-controls, even when Stop was pressed.
            const bindingDeadline = Date.now() + 2500;
            while (!panel && trigger.isConnected && visibleMenus().length <= 1 && Date.now() < bindingDeadline) {
                capturePanel();
                if (panel || (pendingPanel && !pendingPanel.isConnected)) break;
                await sleep(30);
            }
            // Toggle only our exact row trigger; Material routes Escape through the overlay dispatcher.
            if (panel && associated() && (!pendingPanel || pendingPanel === panel) && !visibleMenus().some(menu => menu !== panel)) {
                trigger.click();
                const deadline = Date.now() + 1200;
                while (downloadVisible(panel) && Date.now() < deadline) {
                    if (document.getElementById(panelId) !== panel || visibleMenus().some(menu => menu !== panel)) throw new Error(t('downloadMenuIdentity'));
                    await sleep(30);
                }
                if (downloadVisible(panel) || visibleMenus().length) throw new Error(t('downloadMenuIdentity'));
            } else if (panelId) throw new Error(t('downloadMenuIdentity'));
        }
    }

    async function resolveDownloadJob(job, checkActive = checkDownloadActive) {
        checkActive();
        if (!job?.row) throw new Error(t('downloadMissing'));
        const page = readDownloadPage(), jobs = page.jobs;
        let fresh = jobs.find(item => item.row === job.row);
        if (!fresh) {
            const matches = jobs.filter(item => item.key === job.key);
            if (matches.length === 1) fresh = matches[0];
        }
        if (!fresh && job.id) {
            // Metadata only narrows candidates; a fresh menu ID must prove the match after rerender.
            const matches = [];
            for (const candidate of jobs.filter(item => item.name === job.name && item.modified === job.modified)) {
                if (!downloadVisible(candidate.row)) throw new Error(t('downloadMissing'));
                const resolved = await resolveDownloadJob(candidate, checkActive);
                if (resolved.key === job.key) matches.push(resolved);
            }
            const current = readDownloadPage();
            if (matches.length !== 1 || current.signature !== page.signature ||
                current.jobs.some((item, index) => item.row !== jobs[index]?.row)) throw new Error(t('downloadMissing'));
            return matches[0];
        }
        if (!fresh || fresh.name !== job.name || fresh.modified !== job.modified) throw new Error(t('downloadMissing'));
        const row = fresh.row;
        const id = readDownloadIdentity(row) || await readDownloadMenuIdentity(row, null, checkActive);
        checkActive();
        fresh = readDownloadPage().jobs.find(item => item.row === row);
        if (!fresh || fresh.name !== job.name || fresh.modified !== job.modified || (fresh.id && fresh.key !== `id:${id}`)) throw new Error(t('downloadMissing'));
        return id ? { ...fresh, key: `id:${id}`, id: true } : fresh;
    }

    async function resolveDownloadPage(page, candidates = page.jobs) {
        const jobs = [], keys = new Set();
        for (const job of candidates) {
            const resolved = await resolveDownloadJob(job);
            if (keys.has(resolved.key)) throw new Error(t(resolved.id ? 'downloadPageError' : 'downloadAmbiguous'));
            keys.add(resolved.key); jobs.push(resolved);
        }
        const fresh = readDownloadPage();
        if (fresh.signature !== page.signature || fresh.jobs.some((job, index) => job.row !== page.jobs[index]?.row)) throw new Error(t('downloadPageError'));
        return { ...page, jobs };
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
            page = await resolveDownloadPage(page, page.jobs.filter(job =>
                records.some(target => job.name === target.name && job.modified === target.modified)));
            checkDownloadActive();
            if (visited.has(page.signature) || visited.size >= 1000) throw new Error(t('downloadPageError'));
            visited.add(page.signature);
            for (const job of page.jobs) {
                const target = targets.get(job.key);
                if (!target) continue;
                const fresh = await resolveDownloadJob(job);
                if (!sameDownloadJob(fresh, target)) throw new Error(t('downloadMissing'));
                const checkbox = nativeDownloadCheckbox(fresh);
                if (checkbox.checked) throw new Error(t('downloadNativeMismatch'));
                mutateNativeSelection(() => checkbox.click());
                await downloadDelay(70);
                const checked = await resolveDownloadJob(fresh);
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

    async function collectNativeDownloadSelection(targets) {
        const expected = getNativeDownloadToolbar().count;
        if (!expected) throw new Error(t('downloadNoSelection'));
        // Native history counts selected IDs globally. Fallback name/time identities still need a full ambiguity check.
        const canStopEarly = targets.every(job => job.id) && getDownloadHistory().root.matches?.('gdm-af-history');
        const records = [], identities = new Set(), visited = new Set();
        let page = await firstDownloadPage();
        while (true) {
            page = await resolveDownloadPage(page, page.jobs.filter(job =>
                nativeDownloadCheckbox(job).checked || targets.some(target =>
                    !target.id && job.name === target.name && job.modified === target.modified)));
            checkDownloadActive();
            if (getNativeDownloadToolbar().count !== expected) throw new Error(t('downloadNativeMismatch'));
            if (visited.has(page.signature) || visited.size >= 1000) throw new Error(t('downloadPageError'));
            visited.add(page.signature);
            for (const cached of page.jobs) {
                const job = await resolveDownloadJob(cached);
                if (identities.has(job.key)) throw new Error(t(job.id ? 'downloadPageError' : 'downloadAmbiguous'));
                identities.add(job.key);
                if (nativeDownloadCheckbox(job).checked) {
                    const { row, ...record } = job;
                    records.push(record);
                }
            }
            if (records.length > expected) throw new Error(t('downloadNativeMismatch'));
            if ((canStopEarly && records.length === expected) || !downloadButtonEnabled(page.next)) break;
            page = await moveDownloadPage(page.next, page.signature);
        }
        await firstDownloadPage();
        if (records.length !== expected || getNativeDownloadToolbar().count !== expected) throw new Error(t('downloadNativeMismatch'));
        return records;
    }

    function downloadReadiness() {
        if (fastaState.busy) return { key: 'fastaBusy', color: 'var(--af3-warning)' };
        if (downloadState.busy) return { key: downloadState.phase === 'batch' ? 'downloadRunningBatch' : downloadState.phase === 'extract' ? 'scoreRunning' : downloadState.phase === 'scan' ? 'downloadRunningScan' : downloadState.phase === 'save' ? 'downloadRunningSave' : 'downloadRunningApply', color: 'var(--af3-warning)' };
        if (isRunning) return { key: 'downloadSubmissionBusy', color: 'var(--af3-warning)' };
        let context;
        try { context = getDownloadContext(); }
        catch (_) { return { key: 'downloadStandby', color: 'var(--af3-muted)' }; }
        if (downloadState.complete && context !== downloadState.scanContext) return { key: 'downloadContextChanged', color: 'var(--af3-warning)' };
        try {
            const { count } = getNativeDownloadToolbar();
            if (count > 50) return { key: 'downloadLimit', color: 'var(--af3-warning)' };
            if (count === 1 && downloadState.queue) return { key: 'downloadReadyIndividual', color: 'var(--af3-primary)' };
            if (count) return { key: 'downloadReadyWeb', vars: { count }, color: 'var(--af3-info)' };
            return { key: !downloadState.complete ? 'downloadReadyFind' : downloadState.selected.size ? 'downloadReadyApply' : 'downloadReadySelect', color: 'var(--af3-primary)' };
        } catch (_) { return { key: 'downloadNativeMissing', color: 'var(--af3-warning)' }; }
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
        showMessageError(getUiElement('af3-download-status'), false);
        downloadState.message = key;
        downloadState.messageVars = vars;
        renderDownloadSection();
    }

    function updateDownloadControls() {
        const busy = downloadState.busy || isRunning || fastaState.busy;
        const toggle = getUiElement('af3-panel-toggle');
        if (toggle) {
            const collapsed = getPanelHost().hasAttribute('data-collapsed');
            toggle.disabled = busy; toggle.textContent = collapsed ? '+' : '−';
            toggle.setAttribute('aria-expanded', String(!collapsed));
            toggle.setAttribute('aria-label', t(collapsed ? 'panelExpand' : 'panelCollapse'));
            toggle.title = toggle.getAttribute('aria-label');
        }
        updateAccountSwitchControl();
        if (!busy && downloadState.queue) {
            try {
                if (downloadState.queue.context !== getDownloadContext()) throw new Error();
            } catch (_) {
                resetDownloadQueue('downloadContextChanged');
                renderDownloadSection();
                return;
            }
        }
        for (const id of ['start', 'end', 'scan', 'all', 'batch', 'clear', 'format']) {
            const control = getUiElement(`af3-download-${id}`);
            if (control) control.disabled = busy || (['all', 'batch', 'clear'].includes(id) && (!downloadState.complete || !downloadState.jobs.length));
        }
        for (const id of ['apply', 'save']) {
            const button = getUiElement(`af3-download-${id}`);
            if (button) button.disabled = busy || !downloadState.complete || downloadState.selected.size === 0;
        }
        const extract = getUiElement('af3-download-extract');
        if (extract) extract.disabled = busy;
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
            const error = ['error', 'downloadError', 'downloadSaveError', 'scoreError', 'downloadInvalidRange',
                'downloadNoSelection', 'downloadBatchOpen', 'downloadBatchEmpty', 'downloadContextChanged', 'downloadNativeChanged'].includes(key);
            showMessageError(status, error, key === 'error' ? downloadState.messageVars.detail : t(key, vars));
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
            // ponytail: native details handle disclosure; preserve open dates across language redraws.
            const openDays = new Set(Array.from(list.querySelectorAll('details[open]'), group => group.dataset.day));
            list.replaceChildren();
            const groups = new Map();
            for (const job of downloadState.jobs) {
                if (!groups.has(job.day)) groups.set(job.day, []);
                groups.get(job.day).push(job);
            }
            for (const [day, jobs] of [...groups].sort((a, b) => b[0].localeCompare(a[0]))) {
                const group = document.createElement('details');
                const groupHeader = document.createElement('summary');
                group.className = 'af3-day-group'; group.dataset.day = day;
                group.open = openDays.has(day);
                groupHeader.className = 'af3-day-heading';
                const master = document.createElement('input');
                master.type = 'checkbox'; master.dataset.day = day;
                master.setAttribute('aria-label', t('downloadDay', { day, count: jobs.length }));
                master.onclick = event => event.stopPropagation();
                master.onchange = () => {
                    if (downloadState.busy || isRunning || fastaState.busy) return;
                    resetDownloadQueue('downloadQueueInvalid');
                    for (const job of jobs) master.checked ? downloadState.selected.add(job.key) : downloadState.selected.delete(job.key);
                    renderDownloadSection();
                };
                groupHeader.append(master, document.createTextNode(t('downloadDay', { day, count: jobs.length })));
                group.appendChild(groupHeader);
                for (const job of jobs) {
                    const label = document.createElement('label');
                    label.className = 'af3-job';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox'; checkbox.dataset.jobKey = job.key;
                    checkbox.onchange = () => {
                        if (downloadState.busy || isRunning || fastaState.busy) return;
                        resetDownloadQueue('downloadQueueInvalid');
                        checkbox.checked ? downloadState.selected.add(job.key) : downloadState.selected.delete(job.key);
                        renderDownloadSection();
                    };
                    const text = document.createElement('span');
                    const name = document.createElement('span'); name.className = 'af3-job-name'; name.textContent = job.name;
                    const modified = document.createElement('span'); modified.className = 'af3-job-date'; modified.textContent = job.modified;
                    text.append(name, modified);
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
        if (isRunning || downloadState.busy || fastaState.busy) return;
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
            downloadState.context = getDownloadContext();
            await selectHistoryScanPageSize(downloadState, getDownloadContext, 'pageSize', checkDownloadActive);
            downloadState.scanContext = downloadState.context;
            addLog(t('downloadLogStart', { start, end, filters: JSON.parse(downloadState.context).selected.join(', ') }));
            const history = getDownloadHistory();
            const { sort, search } = JSON.parse(downloadState.context);
            // Native unsearched MatTable data is sorted by Modified before pagination; search results need not be.
            let newestFirst = history.root.matches?.('gdm-af-history') && (
                (sort.length === 1 && sort[0][0] === 'Modified' && sort[0][1] === 'descending') ||
                (!sort.length && !search && history.table?.hasAttribute('mat-table')));
            let previousDay = null;
            const visited = new Set(), identities = new Map(), matches = [];
            let page = await firstDownloadPage();
            while (true) {
                checkDownloadActive();
                if (visited.has(page.signature) || visited.size >= 1000) throw new Error(t('downloadPageError'));
                visited.add(page.signature);
                for (const job of page.jobs) {
                    if (!job.day) { downloadState.unknown++; newestFirst = false; continue; }
                    if (previousDay && job.day > previousDay) newestFirst = false;
                    previousDay = job.day;
                }
                const pastStart = newestFirst && page.jobs.length > 0 && previousDay < start;
                page = await resolveDownloadPage(page, page.jobs.filter(job => job.day && job.day >= start && job.day <= end));
                checkDownloadActive();
                for (const job of page.jobs) {
                    if (identities.has(job.key)) {
                        throw new Error(t(job.id ? 'downloadPageError' : 'downloadAmbiguous'));
                    }
                    identities.set(job.key, job);
                    const { row, ...record } = job;
                    matches.push(record);
                }
                setDownloadMessage('downloadScanning', { page: visited.size, count: matches.length });
                if (pastStart || !downloadButtonEnabled(page.next)) break;
                page = await moveDownloadPage(page.next, page.signature);
            }
            await firstDownloadPage();
            checkDownloadActive();
            downloadState.jobs = matches;
            downloadState.selected = new Set(matches.map(job => job.key));
            downloadState.complete = true;
            setDownloadMessage('downloadFound');
            addLog(t('downloadLogResult', { count: matches.length, unknown: downloadState.unknown }));
        } catch (error) {
            setDownloadMessage(isUserStopError(error) ? 'downloadIncomplete' : 'error', { detail: error.message });
            addLog(t('fastaLogError', { detail: error.message }), 'error');
        } finally {
            downloadState.busy = false;
            renderDownloadSection();
            checkSystemStatus();
        }
    }

    async function applySelectionToWebsite(advance = false) {
        if (isRunning || downloadState.busy || fastaState.busy) return;
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
                const current = await collectNativeDownloadSelection([previousQueue.records[previousQueue.index]]);
                if (current.length !== 1 || !sameDownloadJob(current[0], previousQueue.records[previousQueue.index])) throw new Error(t('downloadNativeMismatch'));
            }
            await applyNativeDownloadSelection(records);
            const verified = await collectNativeDownloadSelection(records);
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

    function resultZipComplete(tail, size) {
        const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
        for (let i = tail.length - 22; i >= 0; i--) {
            if (view.getUint32(i, true) !== 0x06054b50 || i + 22 + view.getUint16(i + 20, true) !== tail.length) continue;
            // Single-file, non-ZIP64 archives only; never commit a truncated response as a ZIP.
            return view.getUint16(i + 4, true) === 0 && view.getUint16(i + 6, true) === 0 &&
                view.getUint16(i + 8, true) === view.getUint16(i + 10, true) && view.getUint16(i + 10, true) !== 0xffff &&
                view.getUint32(i + 12, true) + view.getUint32(i + 16, true) <= size - (tail.length - i);
        }
        return false;
    }

    async function saveResultZip(directory, name, url, verify) {
        checkDownloadActive();
        const controller = downloadState.controller;
        let reader = null, writer = null, handle = null, committed = false, timer = null;
        const resetTimeout = () => {
            clearTimeout(timer);
            timer = setTimeout(() => controller.abort(), 60000);
        };
        try {
            resetTimeout();
            let response;
            try { response = await fetch(url, { mode: 'same-origin', credentials: 'same-origin', redirect: 'error', signal: controller.signal }); }
            catch (_) { throw new Error(t('downloadSaveTransfer')); }
            checkDownloadActive();
            const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
            if (!response.ok || response.redirected || !response.body ||
                !['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(type)) throw new Error(t('downloadSaveResponse'));
            reader = response.body.getReader();
            handle = await directory.getFileHandle(name, { create: true });
            if ((await handle.getFile()).size !== 0) { handle = null; throw new Error(t('downloadSaveWrite')); }
            checkDownloadActive();
            try { writer = await handle.createWritable({ mode: 'exclusive' }); }
            catch (_) { throw new Error(t('downloadSaveWrite')); }
            let size = 0, prefix = new Uint8Array(), tail = new Uint8Array();
            while (true) {
                checkDownloadActive();
                let chunk;
                try { chunk = await reader.read(); }
                catch (_) { throw new Error(t('downloadSaveTransfer')); }
                checkDownloadActive();
                if (chunk.done) break;
                resetTimeout();
                const bytes = chunk.value;
                size += bytes.length;
                if (prefix.length < 4) {
                    const joined = new Uint8Array(prefix.length + bytes.length);
                    joined.set(prefix); joined.set(bytes, prefix.length); prefix = joined.slice(0, 4);
                }
                if (prefix.length === 4 && !(prefix[0] === 80 && prefix[1] === 75 &&
                    ((prefix[2] === 3 && prefix[3] === 4) || (prefix[2] === 5 && prefix[3] === 6)))) throw new Error(t('downloadSaveResponse'));
                const joined = new Uint8Array(tail.length + bytes.length);
                joined.set(tail); joined.set(bytes, tail.length); tail = joined.slice(-65557);
                try { await writer.write(bytes); }
                catch (_) { throw new Error(t('downloadSaveWrite')); }
            }
            const length = response.headers.get('Content-Length');
            const encoding = response.headers.get('Content-Encoding');
            if (size < 22 || !resultZipComplete(tail, size) ||
                ((!encoding || encoding === 'identity') && length !== null && (!/^\d+$/.test(length) || Number(length) !== size))) throw new Error(t('downloadSaveResponse'));
            await verify();
            checkDownloadActive();
            if (controller.signal.aborted) throw new Error(t('downloadSaveTransfer'));
            try { await writer.close(); committed = true; }
            catch (_) { throw new Error(t('downloadSaveWrite')); }
        } finally {
            clearTimeout(timer);
            try { await reader?.cancel(); } catch (_) {}
            if (!committed) {
                try { await writer?.abort(); } catch (_) {}
                // Only remove this operation's new, still-empty placeholder, never an existing result.
                if (handle) {
                    try {
                        const current = await directory.getFileHandle(name);
                        if (await current.isSameEntry(handle) && (await current.getFile()).size === 0) await directory.removeEntry(name);
                    } catch (_) { throw Object.assign(new Error(t('downloadSaveCleanup', { name })), { resultCleanup: true }); }
                }
            }
        }
    }

    function boundDownloadJobs(manifest, account) {
        const bound = new Map();
        for (const batch of manifest.batches) {
            if (normalizeAccountEmail(batch.account) !== account) continue;
            for (const job of batch.jobs) {
                if (!job.jobId || typeof job.jobId !== 'string' || /[\\/\s?#\x00-\x1f\x7f]/.test(job.jobId) || job.importStatus !== 'confirmed') continue;
                const key = 'id:' + job.jobId;
                if (bound.has(key)) throw new Error(t('downloadSaveMismatch'));
                bound.set(key, job);
            }
        }
        return bound;
    }

    async function selectCurrentDownloadBatch() {
        if (isRunning || downloadState.busy || fastaState.busy || !downloadState.complete || !downloadState.jobs.length) return;
        if (!fastaState.dir || !fastaState.saved || !fastaState.manifest?.generationComplete) { setDownloadMessage('downloadBatchOpen'); return; }
        const directory = fastaState.dir, runId = fastaState.manifest.runId;
        downloadState.context = downloadState.scanContext;
        downloadState.stop = false; downloadState.selectionChanged = false;
        downloadState.busy = true; downloadState.phase = 'batch';
        checkSystemStatus(); renderDownloadSection();
        try {
            checkDownloadActive();
            const account = JSON.parse(downloadState.context).account;
            if (!account) throw new Error(t('fastaContextAccountMissing'));
            const { manifest } = await readFastaManifest(directory);
            checkDownloadActive();
            if (manifest.runId !== runId) throw new Error(t('fastaChanged'));
            const bound = boundDownloadJobs(manifest, account);
            const selected = downloadState.jobs.filter(job => job.id && bound.get(job.key)?.name === job.name);
            resetDownloadQueue();
            downloadState.selected = new Set(selected.map(job => job.key));
            setDownloadMessage(selected.length ? 'downloadFound' : 'downloadBatchEmpty');
        } catch (error) {
            if (isUserStopError(error)) setDownloadMessage('downloadBatchStopped');
            else setDownloadMessage('error', { detail: error.message });
        } finally { downloadState.busy = false; renderDownloadSection(); checkSystemStatus(); }
    }

    async function saveDownloadResults() {
        if (isRunning || downloadState.busy || fastaState.busy) return;
        if (!downloadState.complete || !downloadState.selected.size) { setDownloadMessage('downloadNoSelection'); return; }
        const progress = { saved: 0, skipped: 0, total: downloadState.selected.size, folder: '' };
        const records = downloadState.jobs.filter(job => downloadState.selected.has(job.key));
        const openedDirectory = fastaState.dir && fastaState.saved && fastaState.manifest?.generationComplete ? fastaState.dir : null;
        if ((!openedDirectory && typeof window.showDirectoryPicker !== 'function') || !navigator.locks?.request) {
            setDownloadMessage('downloadSaveError', { ...progress, detail: t('downloadSaveUnsupported') }); return;
        }
        downloadState.context = downloadState.scanContext;
        downloadState.stop = false; downloadState.selectionChanged = false;
        downloadState.busy = true; downloadState.phase = 'save';
        downloadState.controller = new AbortController();
        resetDownloadQueue();
        let watcher = null, abortReason = null;
        checkSystemStatus();
        renderDownloadSection();
        try {
            checkDownloadActive();
            const account = JSON.parse(downloadState.context).account;
            if (!account) throw new Error(t('fastaContextAccountMissing'));
            // Reuse the writable handle from “Open existing batch folder” or generation. Only ask for a picker when this page has no valid open batch.
            const directory = openedDirectory || await window.showDirectoryPicker({ mode: 'readwrite' });
            checkDownloadActive();
            progress.folder = directory.name;
            let snapshot;
            try { snapshot = await readFastaManifest(directory); }
            catch (_) { throw new Error(t('downloadSaveFolder')); }
            checkDownloadActive();
            const { manifest, text } = snapshot;
            const bound = boundDownloadJobs(manifest, account);
            if (records.length !== progress.total || records.some(job => !job.id || bound.get(job.key)?.name !== job.name)) throw new Error(t('downloadSaveMismatch'));
            if (!confirm(t('downloadSaveConfirm', { count: records.length, folder: directory.name }))) {
                setDownloadMessage('downloadSaveCancelled', progress); return;
            }
            checkDownloadActive();
            watcher = setInterval(() => {
                try { checkDownloadActive(); }
                catch (error) { abortReason ||= error; downloadState.controller?.abort(); }
            }, 100);
            // ponytail: same-origin tabs share one batch lock; use only one browser on a physical folder.
            await navigator.locks.request('af3-results:' + manifest.runId, { mode: 'exclusive', ifAvailable: true }, async lock => {
                if (!lock) throw new Error(t('downloadSaveLocked'));
                checkDownloadActive();
                const output = await directory.getDirectoryHandle('results', { create: true });
                const pending = new Map(records.map(job => [job.key, job]));
                const visited = new Set();
                let page = await firstDownloadPage();
                while (pending.size) {
                    checkDownloadActive();
                    if (visited.has(page.signature) || visited.size >= 1000) throw new Error(t('downloadPageError'));
                    visited.add(page.signature);
                    page = await resolveDownloadPage(page, page.jobs.filter(job =>
                        records.some(target => target.name === job.name && target.modified === job.modified)));
                    for (const job of page.jobs) {
                        const target = pending.get(job.key);
                        if (!target) continue;
                        if (!sameDownloadJob(job, target)) throw new Error(t('downloadMissing'));
                        let stem = job.name.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').replace(/[. ]+$/g, '') || 'result';
                        if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(stem)) stem = '_' + stem;
                        const name = stem.slice(0, 100) + '__' + (await fastaHash(job.key)).slice(0, 16) + '.zip';
                        checkDownloadActive();
                        let exists = false;
                        try { await output.getFileHandle(name); exists = true; }
                        catch (error) { if (error.name !== 'NotFoundError') throw error; }
                        if (exists) progress.skipped++;
                        else {
                            const url = await readDownloadMenuIdentity(job.row, job);
                            if (!url) throw new Error(t('downloadSaveLink'));
                            const verify = async () => {
                                if (!sameDownloadJob(await resolveDownloadJob(job), target)) throw new Error(t('downloadMissing'));
                                const current = await (await directory.getFileHandle('manifest.json')).getFile();
                                if (current.size > FASTA_MANIFEST_LIMIT || await current.text() !== text) throw new Error(t('fastaJournalChanged'));
                            };
                            await verify();
                            setDownloadMessage('downloadSaveProgress', { ...progress, name: job.name });
                            await saveResultZip(output, name, url, verify);
                            // Count only committed files, even if Stop arrived while close() was in flight.
                            progress.saved++;
                            addLog(t('downloadSaveProgress', { ...progress, name: job.name }));
                        }
                        pending.delete(job.key);
                        checkDownloadActive();
                    }
                    if (!pending.size) break;
                    if (!downloadButtonEnabled(page.next)) throw new Error(t('downloadMissing'));
                    page = await moveDownloadPage(page.next, page.signature);
                }
                await firstDownloadPage();
                checkDownloadActive();
            });
            setDownloadMessage('downloadSaveDone', progress);
            addLog(t('downloadSaveDone', progress));
        } catch (error) {
            if (!error.resultCleanup) {
                error = abortReason || error;
                if (downloadState.stop) error = makeStoppedError();
            }
            const cancelled = error.name === 'AbortError' || isUserStopError(error);
            if (!cancelled) downloadState.complete = false;
            setDownloadMessage(cancelled ? 'downloadSaveCancelled' : 'downloadSaveError', { ...progress, detail: error.message });
            addLog(t(cancelled ? 'downloadSaveCancelled' : 'downloadSaveError', { ...progress, detail: error.message }), cancelled ? 'warn' : 'error');
        } finally {
            clearInterval(watcher);
            downloadState.controller.abort(); downloadState.controller = null;
            downloadState.busy = false;
            renderDownloadSection(); checkSystemStatus();
        }
    }

    // --- Local score extraction: milk-compatible metrics; no website requests. ---
    const SCORE_JSON_LIMIT = 128 * 1024 * 1024;
    const SCORE_CSV_LIMIT = 128 * 1024 * 1024;
    const SCORE_ROW_LIMIT = 100000;
    const SCORE_SCALARS = ['iptm', 'ptm', 'ranking_score', 'fraction_disordered', 'has_clash'];
    const SCORE_STRUCTURE = ['n_tokens', 'n_atoms', 'plddt_mean', 'plddt_min', 'pae_inter_min', 'pae_inter_mean'];
    const SCORE_SINGLE_FIELDS = ['job', 'job_name', 'model', 'n_chains', 'chain_ids', 'long_peptide', 'long_peptide_len',
        'short_peptide', 'short_peptide_len', 'iptm', 'ptm', 'interface_iptm', 'ranking_score', 'fraction_disordered', 'has_clash'];
    const SCORE_MERGED_FIELDS = ['fasta_header', 'in_fasta', 'job', 'source_zip', 'model', 'n_chains', 'chain_ids',
        'receptor_len', 'peptide', 'peptide_len', 'iptm', 'ptm', 'interface_iptm', 'ranking_score', 'fraction_disordered', 'has_clash'];
    const SCORE_PAIR_FIELDS = ['job', 'model', 'chain_i', 'chain_j', 'pair_iptm', 'pair_pae_min'];
    const SCORE_MISSING_FIELDS = ['fasta_header', 'norm_key', 'n_jobs_found', 'n_fasta_copies'];
    const SCORE_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
        for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
        return value >>> 0;
    });

    function scoreCheck() {
        if (downloadState.stop) throw makeStoppedError();
    }

    function scoreFail(key = 'scoreInvalidZip', name = '') {
        return new Error(t(key, { name }));
    }

    function scoreCompare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

    // Python round uses the binary float's exact value and ties-to-even, unlike Math.round/toFixed.
    function scoreRound(value, digits = 4) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'boolean') return value;
        if (typeof value !== 'number' || !Number.isFinite(value)) throw scoreFail('scoreInvalidData');
        if (Number.isInteger(value)) return value;
        const view = new DataView(new ArrayBuffer(8));
        view.setFloat64(0, Math.abs(value));
        const bits = view.getBigUint64(0), exponent = Number((bits >> 52n) & 0x7ffn);
        let mantissa = bits & ((1n << 52n) - 1n);
        if (exponent) mantissa |= 1n << 52n;
        mantissa *= 5n ** BigInt(digits);
        const shift = (exponent || 1) - 1023 - 52 + digits;
        let rounded;
        if (shift >= 0) rounded = mantissa << BigInt(shift);
        else {
            const denominator = 1n << BigInt(-shift), remainder = mantissa % denominator;
            rounded = mantissa / denominator;
            if (remainder * 2n > denominator || (remainder * 2n === denominator && (rounded & 1n))) rounded++;
        }
        return (value < 0 ? -1 : 1) * Number(rounded) / 10 ** digits;
    }

    async function scoreCrc(bytes) {
        let crc = 0xffffffff;
        for (let i = 0; i < bytes.length; i++) {
            crc = (crc >>> 8) ^ SCORE_CRC_TABLE[(crc ^ bytes[i]) & 255];
            if (i && i % 1048576 === 0) { scoreCheck(); await sleep(0); }
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    async function scoreZipEntries(file) {
        scoreCheck();
        if (file.size < 22 || file.size >= 0xffffffff) throw scoreFail('scoreInvalidZip', file.name);
        const tailStart = Math.max(0, file.size - 65557);
        const tail = new Uint8Array(await file.slice(tailStart).arrayBuffer());
        const endView = new DataView(tail.buffer);
        let end = -1;
        for (let i = tail.length - 22; i >= 0; i--) {
            if (endView.getUint32(i, true) === 0x06054b50 && i + 22 + endView.getUint16(i + 20, true) === tail.length) { end = i; break; }
        }
        if (end < 0) throw scoreFail('scoreInvalidZip', file.name);
        const count = endView.getUint16(end + 10, true), size = endView.getUint32(end + 12, true), offset = endView.getUint32(end + 16, true);
        if (endView.getUint16(end + 4, true) || endView.getUint16(end + 6, true) ||
            count !== endView.getUint16(end + 8, true) || count === 0xffff || size > 32 * 1024 * 1024 ||
            offset + size !== tailStart + end) throw scoreFail('scoreUnsupportedZip', file.name);
        const bytes = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
        const view = new DataView(bytes.buffer), decoder = new TextDecoder('utf-8', { fatal: true });
        const entries = [], names = new Set(), regions = [];
        let cursor = 0, inflated = 0;
        for (let index = 0; index < count; index++) {
            scoreCheck();
            if (cursor + 46 > size || view.getUint32(cursor, true) !== 0x02014b50) throw scoreFail('scoreInvalidZip', file.name);
            const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true);
            const crc = view.getUint32(cursor + 16, true), compressed = view.getUint32(cursor + 20, true), length = view.getUint32(cursor + 24, true);
            const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
            const disk = view.getUint16(cursor + 34, true);
            const start = view.getUint32(cursor + 42, true), next = cursor + 46 + nameLength + extraLength + commentLength;
            if (next > size || !nameLength || compressed === 0xffffffff || length === 0xffffffff || start === 0xffffffff ||
                flags & 0x41 || ![0, 8].includes(method) || disk || start + 30 + compressed > offset) throw scoreFail('scoreUnsupportedZip', file.name);
            let name;
            try { name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)); }
            catch (_) { throw scoreFail('scoreUnsupportedZip', file.name); }
            const path = name.replace(/\/$/, '').split('/');
            if (/^[A-Za-z]:|^[\/]|[\\\x00-\x1f\x7f]/.test(name) || path.some(part => !part || part === '.' || part === '..') || names.has(name)) throw scoreFail('scoreInvalidZip', file.name);
            names.add(name);
            const match = /^(.+)_(job_request|summary_confidences_\d+|full_data_\d+)\.json$/.exec(path.at(-1));
            if (match) {
                if (length > SCORE_JSON_LIMIT || compressed > SCORE_JSON_LIMIT || (inflated += length) > 2 * 1024 ** 3) throw scoreFail('scoreLimit', file.name);
                const job = path.length > 1 ? path[0] : match[1].replace(/^fold_/, '');
                entries.push({ name, job, kind: match[2].split(/_\d+$/)[0], model: Number(match[2].split('_').at(-1)),
                    flags, method, crc, compressed, length, start, nameBytes: bytes.slice(cursor + 46, cursor + 46 + nameLength), directoryOffset: offset });
                regions.push([start, start + 30 + compressed]);
            }
            cursor = next;
        }
        if (cursor !== size) throw scoreFail('scoreInvalidZip', file.name);
        regions.sort((a, b) => a[0] - b[0]);
        if (regions.some((region, index) => index && region[0] < regions[index - 1][1])) throw scoreFail('scoreInvalidZip', file.name);
        return entries.sort((a, b) => scoreCompare(a.name, b.name));
    }

    async function scoreReadJson(file, entry) {
        scoreCheck();
        const header = new Uint8Array(await file.slice(entry.start, entry.start + 30).arrayBuffer());
        const view = new DataView(header.buffer);
        if (header.length !== 30 || view.getUint32(0, true) !== 0x04034b50 || view.getUint16(6, true) !== entry.flags ||
            view.getUint16(8, true) !== entry.method) throw scoreFail('scoreInvalidZip', file.name);
        const nameLength = view.getUint16(26, true), extraLength = view.getUint16(28, true);
        const payload = entry.start + 30 + nameLength + extraLength;
        if (nameLength !== entry.nameBytes.length || payload + entry.compressed > entry.directoryOffset) throw scoreFail('scoreInvalidZip', file.name);
        const name = new Uint8Array(await file.slice(entry.start + 30, entry.start + 30 + nameLength).arrayBuffer());
        if (name.some((value, index) => value !== entry.nameBytes[index]) || (!(entry.flags & 8) &&
            (view.getUint32(14, true) !== entry.crc || view.getUint32(18, true) !== entry.compressed || view.getUint32(22, true) !== entry.length))) throw scoreFail('scoreInvalidZip', file.name);
        let stream = file.slice(payload, payload + entry.compressed).stream();
        if (entry.method === 8) {
            let decompressor;
            try { decompressor = new DecompressionStream('deflate-raw'); }
            catch (_) { throw scoreFail('scoreUnsupportedBrowser'); }
            stream = stream.pipeThrough(decompressor);
        }
        const reader = stream.getReader(), chunks = [];
        let length = 0;
        try {
            while (true) {
                scoreCheck();
                const { done, value } = await reader.read();
                scoreCheck();
                if (done) break;
                length += value.length;
                if (length > entry.length || length > SCORE_JSON_LIMIT) throw scoreFail('scoreLimit', file.name);
                chunks.push(value);
            }
        } catch (error) {
            if (isUserStopError(error)) throw error;
            throw scoreFail('scoreInvalidZip', file.name);
        } finally { try { await reader.cancel(); } catch (_) {} }
        if (length !== entry.length) throw scoreFail('scoreInvalidZip', file.name);
        const data = new Uint8Array(length);
        let at = 0;
        for (const chunk of chunks) { data.set(chunk, at); at += chunk.length; }
        if (await scoreCrc(data) !== entry.crc) throw scoreFail('scoreInvalidZip', file.name);
        let parsed;
        try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)); }
        catch (_) { throw scoreFail('scoreInvalidData', entry.name); }
        scoreCheck();
        return parsed;
    }

    async function scoreStructure(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw scoreFail('scoreInvalidData');
        const pae = data.pae ?? [], atoms = data.atom_plddts ?? [], chains = data.token_chain_ids ?? [];
        if (!Array.isArray(pae) || !Array.isArray(atoms) || !Array.isArray(chains) || pae.length > 10000 || atoms.length > 1000000 ||
            (pae.length && chains.length !== pae.length)) throw scoreFail('scoreInvalidData');
        // Compensated sums match modern Python sum() without constructing an O(n²) cross-chain array.
        const stats = () => ({ sum: 0, correction: 0, min: Infinity, count: 0 });
        const add = (acc, value) => {
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw scoreFail('scoreInvalidData');
            const next = acc.sum + value;
            acc.correction += Math.abs(acc.sum) >= Math.abs(value) ? (acc.sum - next) + value : (value - next) + acc.sum;
            acc.sum = next; acc.min = Math.min(acc.min, value); acc.count++;
        };
        const plddt = stats(), inter = stats();
        for (const value of atoms) add(plddt, value);
        for (let i = 0; i < pae.length; i++) {
            if (!Array.isArray(pae[i]) || pae[i].length !== pae.length || typeof chains[i] !== 'string') throw scoreFail('scoreInvalidData');
            for (let j = 0; j < pae.length; j++) {
                const value = pae[i][j];
                if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw scoreFail('scoreInvalidData');
                if (i !== j && chains[i] !== chains[j]) add(inter, value);
            }
            if (i % 64 === 0) { scoreCheck(); await sleep(0); }
        }
        return { n_tokens: pae.length, n_atoms: atoms.length,
            plddt_mean: plddt.count ? scoreRound((plddt.sum + plddt.correction) / plddt.count, 2) : '',
            plddt_min: plddt.count ? scoreRound(plddt.min, 2) : '',
            pae_inter_min: inter.count ? scoreRound(inter.min, 2) : '',
            pae_inter_mean: inter.count ? scoreRound((inter.sum + inter.correction) / inter.count, 2) : '' };
    }

    async function scoreReadArchive(file) {
        const entries = await scoreZipEntries(file), requests = new Map(), structures = new Map(), models = new Set(), rows = [], pairs = [];
        const object = value => value && typeof value === 'object' && !Array.isArray(value);
        for (const entry of entries.filter(item => item.kind !== 'summary_confidences')) {
            const data = await scoreReadJson(file, entry);
            if (entry.kind === 'job_request') {
                if (requests.has(entry.job) || !Array.isArray(data) || data.length !== 1 || !object(data[0]) || !Array.isArray(data[0].sequences)) throw scoreFail('scoreInvalidData', entry.name);
                const sequences = [];
                for (const entity of data[0].sequences) {
                    if (!object(entity)) throw scoreFail('scoreInvalidData', entry.name);
                    for (const value of Object.values(entity)) {
                        if (object(value) && 'sequence' in value) {
                            if (typeof value.sequence !== 'string' || value.sequence.length > 100000) throw scoreFail('scoreInvalidData', entry.name);
                            sequences.push(value.sequence);
                        }
                    }
                }
                if (data[0].name !== undefined && typeof data[0].name !== 'string') throw scoreFail('scoreInvalidData', entry.name);
                requests.set(entry.job, { name: data[0].name || entry.job, sequences });
            } else {
                const key = JSON.stringify([entry.job, entry.model]);
                if (!Number.isSafeInteger(entry.model) || structures.has(key)) throw scoreFail('scoreInvalidData', entry.name);
                structures.set(key, await scoreStructure(data));
            }
        }
        for (const entry of entries.filter(item => item.kind === 'summary_confidences')) {
            scoreCheck();
            const data = await scoreReadJson(file, entry), key = JSON.stringify([entry.job, entry.model]);
            if (!object(data) || models.has(key) || !Number.isSafeInteger(entry.model) || typeof data.ranking_score !== 'number' || !Number.isFinite(data.ranking_score) ||
                !Array.isArray(data.chain_ids) || !data.chain_ids.length || data.chain_ids.length > 100 ||
                data.chain_ids.some(id => typeof id !== 'string' || !id || id.length > 32 || /[\x00-\x1f\x7f]/.test(id)) || new Set(data.chain_ids).size !== data.chain_ids.length) throw scoreFail('scoreInvalidData', entry.name);
            models.add(key);
            const ids = data.chain_ids, request = requests.get(entry.job), sequences = request?.sequences || [];
            const row = { job: entry.job, job_name: request?.name || entry.job, source_zip: file.name, model: entry.model,
                n_chains: ids.length, chain_ids: ids.join(';'), long_peptide: sequences[0] || '', long_peptide_len: (sequences[0] || '').length,
                short_peptide: sequences[1] || '', short_peptide_len: (sequences[1] || '').length, _sequences: JSON.stringify(sequences) };
            for (const field of SCORE_SCALARS) row[field] = scoreRound(data[field]);
            for (const field of ['chain_iptm', 'chain_ptm']) {
                const values = data[field] ?? [];
                if (!Array.isArray(values) || values.length > ids.length) throw scoreFail('scoreInvalidData', entry.name);
                ids.forEach((id, index) => { row[field + '_' + id] = scoreRound(values[index]); });
            }
            for (const field of ['chain_pair_iptm', 'chain_pair_pae_min']) {
                const matrix = data[field] ?? [];
                if (!Array.isArray(matrix) || matrix.length > ids.length || matrix.some(line => !Array.isArray(line) || line.length > ids.length)) throw scoreFail('scoreInvalidData', entry.name);
                for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) {
                    if (i !== j) row['pair_' + field.replace('chain_pair_', '') + '_' + ids[i] + '_' + ids[j]] = scoreRound(matrix[i]?.[j]);
                }
            }
            row.interface_iptm = ids.length > 1 ? scoreRound(data.chain_pair_iptm?.[0]?.[1]) : '';
            Object.assign(row, structures.get(key) || {});
            rows.push(row);
            for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) {
                if (i !== j && data.chain_pair_iptm?.[i]?.[j] !== undefined) pairs.push({ job: entry.job, model: entry.model,
                    chain_i: ids[i], chain_j: ids[j], pair_iptm: row['pair_iptm_' + ids[i] + '_' + ids[j]], pair_pae_min: row['pair_pae_min_' + ids[i] + '_' + ids[j]] });
            }
            if (rows.length > SCORE_ROW_LIMIT || pairs.length > 1000000) throw scoreFail('scoreLimit', file.name);
        }
        if (!rows.length) throw scoreFail('scoreNoModels', file.name);
        return { rows, pairs };
    }

    function scoreFields(rows, base) {
        return [...base, ...[...new Set(rows.flatMap(row => Object.keys(row).filter(key => /^(chain_iptm_|chain_ptm_|pair_)/.test(key))))].sort(scoreCompare), ...SCORE_STRUCTURE];
    }

    function scoreCsv(rows, fields) {
        const cell = value => {
            let text = value === null || value === undefined ? '' : typeof value === 'boolean' ? (value ? 'True' : 'False') : String(value);
            // Formula-looking text is data, never executable spreadsheet content. Numeric negatives stay numeric.
            if (typeof value === 'string' && /^(?:\s*[=+@-]|[\t\r\n])/.test(text)) text = "'" + text;
            return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
        };
        return '﻿' + [fields.map(cell).join(','), ...rows.map(row => fields.map(field => cell(row[field])).join(','))].join('\r\n') + '\r\n';
    }

    function scoreBest(rows) {
        const best = new Map();
        for (const row of rows) if (!best.has(row.job) || row.ranking_score > best.get(row.job).ranking_score) best.set(row.job, row);
        return best;
    }

    function scoreOutputs(archives, manifest) {
        const outputs = [], all = archives.flatMap(archive => archive.rows);
        if (all.length > SCORE_ROW_LIMIT) throw scoreFail('scoreLimit');
        for (const archive of archives) {
            const stem = archive.name.replace(/\.zip$/i, '');
            const best = [...scoreBest(archive.rows).values()].sort((a, b) => b.ranking_score - a.ranking_score);
            outputs.push({ name: stem + '_scores_best.csv', text: scoreCsv(best, scoreFields(archive.rows, SCORE_SINGLE_FIELDS)) },
                { name: stem + '_scores_pairs.csv', text: scoreCsv(archive.pairs, SCORE_PAIR_FIELDS) });
        }
        const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
        const jobs = manifest.batches.flatMap(batch => batch.jobs), best = scoreBest(all), used = new Set(), ordered = [], missing = [];
        const signatures = new Map();
        for (const row of all) {
            const signature = JSON.stringify([row.job_name, row._sequences, row.n_chains]);
            if (signatures.has(row.job) && signatures.get(row.job) !== signature) throw scoreFail('scoreAmbiguous', row.job);
            signatures.set(row.job, signature);
        }
        const exact = new Map(), normalized = new Map(), copies = new Map();
        for (const row of best.values()) {
            const key = normalize(row.job.replace(/_\d+$/, ''));
            if (!exact.has(row.job_name)) exact.set(row.job_name, []);
            if (!normalized.has(key)) normalized.set(key, []);
            exact.get(row.job_name).push(row); normalized.get(key).push(row);
        }
        for (const list of [...exact.values(), ...normalized.values()]) list.sort((a, b) => scoreCompare(a.job, b.job));
        for (const job of jobs) { const key = normalize(job.header); copies.set(key, (copies.get(key) || 0) + 1); }
        for (const job of jobs) {
            const key = normalize(job.header);
            let candidates = (exact.get(job.name) || []).filter(row => !used.has(row.job));
            if (!candidates.length && key) candidates = (normalized.get(key) || []).filter(row => !used.has(row.job));
            if (candidates.length > 1) throw scoreFail('scoreAmbiguous', job.name);
            if (!candidates.length) {
                missing.push({ fasta_header: job.header, norm_key: key, n_jobs_found: 0, n_fasta_copies: copies.get(key) });
            } else {
                const row = candidates[0]; used.add(row.job);
                ordered.push({ ...row, fasta_header: job.header, in_fasta: 'yes' });
            }
        }
        for (const row of [...best.values()].sort((a, b) => scoreCompare(a.job, b.job))) if (!used.has(row.job)) ordered.push({ ...row, fasta_header: '', in_fasta: 'no' });
        const order = new Map(ordered.map((row, index) => [row.job, index])), metadata = new Map(ordered.map(row => [row.job, row]));
        const merged = row => ({ ...row, fasta_header: metadata.get(row.job).fasta_header, in_fasta: metadata.get(row.job).in_fasta,
            receptor_len: row.long_peptide_len, peptide: row.short_peptide, peptide_len: row.short_peptide_len });
        const fields = scoreFields(all, SCORE_MERGED_FIELDS);
        outputs.push({ name: 'all_scores.csv', text: scoreCsv(ordered.map(merged), fields) },
            { name: 'all_scores_all_models.csv', text: scoreCsv([...all].sort((a, b) => order.get(a.job) - order.get(b.job) || a.model - b.model).map(merged), fields) },
            { name: 'all_scores_missing.csv', text: scoreCsv(missing, SCORE_MISSING_FIELDS) });
        const names = new Set();
        let bytes = 0;
        for (const output of outputs) {
            if (/[<>:"/\\|?*\x00-\x1f\x7f]/.test(output.name) || output.name.length > 240 || names.has(output.name.toLowerCase())) throw scoreFail('scoreOutputConflict');
            names.add(output.name.toLowerCase()); bytes += new Blob([output.text]).size;
        }
        if (bytes > SCORE_CSV_LIMIT) throw scoreFail('scoreLimit');
        return { outputs, jobs: best.size, models: all.length, missing: missing.length };
    }

    async function writeScoreCsv(directory, output, verify) {
        await verify();
        let handle = null, writer = null, committed = false;
        try {
            let existing = null;
            try { existing = await directory.getFileHandle(output.name); }
            catch (error) { if (error.name !== 'NotFoundError') throw error; }
            if (Boolean(existing) !== Boolean(output.before)) throw scoreFail('scoreSourceChanged');
            handle = existing || await directory.getFileHandle(output.name, { create: true });
            const before = await handle.getFile();
            if (output.before && (before.size !== output.before.size || before.lastModified !== output.before.lastModified)) throw scoreFail('scoreSourceChanged');
            writer = await handle.createWritable({ mode: 'exclusive' });
            scoreCheck(); await writer.write(output.text); await verify(); scoreCheck();
            const latest = await handle.getFile(), current = await directory.getFileHandle(output.name);
            if (!await current.isSameEntry(handle) || latest.size !== before.size || latest.lastModified !== before.lastModified) throw scoreFail('scoreSourceChanged');
            await writer.close(); committed = true;
        } finally {
            if (!committed) {
                try { await writer?.abort(); } catch (_) {}
                if (handle && !output.before) {
                    try {
                        const current = await directory.getFileHandle(output.name);
                        if (await current.isSameEntry(handle) && (await current.getFile()).size === 0) await directory.removeEntry(output.name);
                    } catch (_) { throw Object.assign(scoreFail('downloadSaveCleanup', output.name), { resultCleanup: true }); }
                }
            }
        }
    }

    async function extractResultScores() {
        if (isRunning || fastaState.busy || downloadState.busy) return;
        const opened = fastaState.dir && fastaState.saved && fastaState.manifest?.generationComplete ? fastaState.dir : null;
        if ((!opened && typeof window.showDirectoryPicker !== 'function') || !navigator.locks?.request) { setDownloadMessage('scoreError', { saved: 0, detail: t('downloadSaveUnsupported') }); return; }
        downloadState.busy = true; downloadState.stop = false; downloadState.phase = 'extract';
        resetDownloadQueue(); checkSystemStatus();
        let saved = 0, current = '';
        try {
            const directory = opened || await window.showDirectoryPicker({ mode: 'readwrite' });
            scoreCheck();
            let snapshot;
            try { snapshot = await readFastaManifest(directory); }
            catch (_) { throw scoreFail('downloadSaveFolder'); }
            const { manifest, text } = snapshot;
            await navigator.locks.request('af3-results:' + manifest.runId, { mode: 'exclusive', ifAvailable: true }, async lock => {
                if (!lock) throw scoreFail('downloadSaveLocked');
                scoreCheck();
                const results = await directory.getDirectoryHandle('results');
                const handles = [];
                for await (const [name, handle] of results.entries()) {
                    scoreCheck();
                    if (handle.kind === 'file' && /\.zip$/i.test(name)) handles.push({ name, handle });
                    if (handles.length > 1000) throw scoreFail('scoreLimit');
                }
                if (!handles.length) throw scoreFail('scoreNoZips');
                handles.sort((a, b) => scoreCompare(a.name, b.name));
                const archives = [];
                let modelCount = 0, pairCount = 0;
                for (const [index, item] of handles.entries()) {
                    current = item.name;
                    setDownloadMessage('scoreReading', { index: index + 1, total: handles.length, name: item.name });
                    await sleep(0); scoreCheck();
                    const file = await item.handle.getFile(); item.file = file;
                    const parsed = await scoreReadArchive(file);
                    if ((modelCount += parsed.rows.length) > SCORE_ROW_LIMIT || (pairCount += parsed.pairs.length) > 1000000) throw scoreFail('scoreLimit');
                    archives.push({ name: item.name, ...parsed });
                }
                const report = scoreOutputs(archives, manifest);
                const verify = async () => {
                    scoreCheck();
                    const disk = await (await directory.getFileHandle('manifest.json')).getFile();
                    if (disk.size > FASTA_MANIFEST_LIMIT || await disk.text() !== text) throw scoreFail('scoreSourceChanged');
                    for (const item of handles) {
                        const file = await item.handle.getFile();
                        if (file.size !== item.file.size || file.lastModified !== item.file.lastModified) throw scoreFail('scoreSourceChanged');
                    }
                    scoreCheck();
                };
                for (const output of report.outputs) {
                    try { output.before = await (await results.getFileHandle(output.name)).getFile(); }
                    catch (error) { if (error.name !== 'NotFoundError') throw error; }
                }
                const overwrite = report.outputs.filter(output => output.before).map(output => output.name);
                if (!confirm(t('scoreConfirm', { count: handles.length, models: report.models, folder: directory.name, files: report.outputs.length,
                    existing: overwrite.length, names: overwrite.join('\n') || '—' }))) { setDownloadMessage('scoreCancelled', { saved }); return; }
                for (const output of report.outputs) {
                    current = output.name;
                    setDownloadMessage('scoreWriting', { saved, total: report.outputs.length, name: current });
                    await writeScoreCsv(results, output, verify); saved++;
                }
                setDownloadMessage('scoreDone', { zips: handles.length, jobs: report.jobs, models: report.models, missing: report.missing, saved, folder: directory.name });
                addLog(t('scoreDone', { zips: handles.length, jobs: report.jobs, models: report.models, missing: report.missing, saved, folder: directory.name }));
            });
        } catch (error) {
            const cancelled = !error.resultCleanup && (isUserStopError(error) || error.name === 'AbortError');
            const detail = ['NotAllowedError', 'NotFoundError', 'NoModificationAllowedError', 'QuotaExceededError'].includes(error.name) ? t('scoreFileError') : error.message;
            setDownloadMessage(cancelled ? 'scoreCancelled' : 'scoreError', { saved, detail: (current ? current + ': ' : '') + detail });
            addLog(cancelled ? t('scoreCancelled', { saved }) : t('scoreError', { saved, detail: (current ? current + ': ' : '') + detail }), cancelled ? 'warn' : 'error');
        } finally { downloadState.busy = false; renderDownloadSection(); checkSystemStatus(); }
    }
    // --- End local score extraction. ---

    function createDownloadSection() {
        const section = document.createElement('section');
        section.id = 'af3-download-section';
        section.className = 'af3-card';
        section.setAttribute('aria-labelledby', 'af3-download-title');
        const translated = (tag, key) => {
            const node = document.createElement(tag); node.dataset.downloadI18n = key; node.textContent = t(key); return node;
        };
        const title = translated('h2', 'downloadTitle');
        title.id = 'af3-download-title';
        section.appendChild(title);
        const ready = document.createElement('div'); ready.className = 'af3-readiness';
        const light = document.createElement('span'); light.id = 'af3-download-ready-light'; light.className = 'af3-status-dot';
        light.setAttribute('aria-hidden', 'true');
        const readyText = document.createElement('span'); readyText.id = 'af3-download-ready-text'; readyText.setAttribute('role', 'status');
        ready.append(light, readyText); section.appendChild(ready);
        const note = translated('p', 'downloadNote'); note.className = 'af3-help'; section.appendChild(note);
        const dates = document.createElement('div'); dates.className = 'af3-dates';
        const today = new Date();
        const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        for (const [id, key] of [['start', 'downloadStart'], ['end', 'downloadEnd']]) {
            const label = document.createElement('label'); label.className = 'af3-field'; label.appendChild(translated('span', key));
            const input = document.createElement('input'); input.type = 'date'; input.id = `af3-download-${id}`; input.value = day;
            input.onchange = () => {
                resetDownloadQueue();
                downloadState.complete = false; downloadState.jobs = []; downloadState.selected.clear(); setDownloadMessage('downloadIdle');
            };
            label.appendChild(input); dates.appendChild(label);
        }
        section.appendChild(dates);
        const actions = document.createElement('div'); actions.className = 'af3-download-tools';
        const selectionActions = document.createElement('div'); selectionActions.className = 'af3-batch-selection';
        const applyActions = document.createElement('div'); applyActions.className = 'af3-download-actions';
        for (const [id, key, action] of [
            ['scan', 'downloadScan', scanDownloadJobs],
            ['all', 'downloadAll', () => { if (downloadState.busy || isRunning || fastaState.busy || !downloadState.complete || !downloadState.jobs.length) return; resetDownloadQueue(); downloadState.selected = new Set(downloadState.jobs.map(job => job.key)); setDownloadMessage('downloadFound'); }],
            ['batch', 'downloadBatch', selectCurrentDownloadBatch],
            ['clear', 'downloadClear', () => { if (downloadState.busy || isRunning || fastaState.busy || !downloadState.complete || !downloadState.jobs.length) return; resetDownloadQueue(); downloadState.selected.clear(); setDownloadMessage('downloadFound'); }],
            ['apply', 'downloadApply', () => applySelectionToWebsite()],
            ['next', 'downloadNext', () => applySelectionToWebsite(true)],
            ['stop', 'stopButton', () => { downloadState.stop = true; downloadState.controller?.abort(); updateDownloadControls(); }],
        ]) {
            const button = translated('button', key); button.type = 'button'; button.id = `af3-download-${id}`;
            button.className = id === 'apply' ? 'af3-primary' : id === 'stop' ? 'af3-danger' : ['all', 'batch', 'clear'].includes(id) ? 'af3-quiet' : '';
            button.onclick = action;
            if (id === 'all' || id === 'batch') {
                if (!selectionActions.parentNode) actions.appendChild(selectionActions);
                selectionActions.appendChild(button);
            } else (id === 'apply' || id === 'next' ? applyActions : actions).appendChild(button);
        }
        section.appendChild(actions);
        const status = document.createElement('p'); status.id = 'af3-download-status'; status.className = 'af3-help';
        status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); section.appendChild(status);
        const list = document.createElement('div'); list.id = 'af3-download-results'; section.appendChild(list);
        const formatLabel = document.createElement('label'); formatLabel.className = 'af3-field';
        formatLabel.appendChild(translated('span', 'downloadFormat'));
        const format = document.createElement('select'); format.id = 'af3-download-format';
        for (const [value, key] of [['combined', 'downloadCombined'], ['individual', 'downloadIndividual']]) {
            const option = translated('option', key); option.value = value; format.appendChild(option);
        }
        format.value = downloadState.format;
        format.onchange = () => {
            downloadState.format = format.value === 'individual' ? 'individual' : 'combined';
            try { localStorage.setItem(DOWNLOAD_FORMAT_KEY, downloadState.format); } catch (_) {}
            resetDownloadQueue('downloadQueueInvalid');
            renderDownloadSection();
        };
        formatLabel.appendChild(format); section.appendChild(formatLabel);
        section.appendChild(applyActions);
        const queue = document.createElement('p'); queue.id = 'af3-download-queue';
        queue.setAttribute('role', 'status'); queue.setAttribute('aria-live', 'polite'); section.appendChild(queue);
        const hint = translated('p', 'downloadHint'); hint.className = 'af3-help af3-download-hint'; section.appendChild(hint);
        const save = translated('button', 'downloadSave'); save.type = 'button'; save.id = 'af3-download-save';
        save.onclick = saveDownloadResults; section.appendChild(save);
        const saveHint = translated('p', 'downloadSaveHint'); saveHint.className = 'af3-help'; section.appendChild(saveHint);
        const extract = translated('button', 'scoreExtract'); extract.type = 'button'; extract.id = 'af3-download-extract';
        extract.onclick = extractResultScores; section.appendChild(extract);
        const scoreHint = translated('p', 'scoreHint'); scoreHint.className = 'af3-help'; section.appendChild(scoreHint);
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
        const styles = document.createElement('style');
        styles.textContent = `
            :host {
                --af3-canvas: #eef3f6; --af3-surface: #fff; --af3-ink: #182f40;
                --af3-muted: #5a6d7b; --af3-border: #d8e2e8;
                --af3-primary: #08777c; --af3-primary-hover: #06686d; --af3-primary-soft: #e7f4f3;
                --af3-info: #285fa5; --af3-info-soft: #edf3fc;
                --af3-warning: #8a5a12; --af3-warning-soft: #fff5e2;
                --af3-danger: #b33e49; --af3-danger-soft: #fff0f1;
                --af3-mono: 'Cascadia Code', Consolas, monospace;
                color-scheme: light;
            }
            :host([data-collapsed]) { height: auto !important; }
            :host([data-collapsed]) #af3-dev-panel-root { height: auto; }
            :host([data-collapsed]) .af3-navigation, :host([data-collapsed]) .af3-workspace, :host([data-collapsed]) #af3-resize-handle { display: none; }
            #af3-panel-toggle { flex-shrink: 0; padding: 4px; }
            *, *::before, *::after { box-sizing: border-box; }
            [hidden] { display: none !important; }
            #af3-dev-panel-root {
                all: initial; box-sizing: border-box; display: flex; flex-direction: column;
                width: 100%; height: 100%; min-height: 0; overflow: clip;
                border: 1px solid var(--af3-border); border-radius: 18px;
                background: var(--af3-canvas); color: var(--af3-ink);
                box-shadow: 0 16px 48px #182f4026, 0 2px 8px #182f4012;
                font: 14px/1.5 'Segoe UI Variable Text', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
                color-scheme: light; container-type: inline-size;
            }
            h2, h3, p { margin: 0; overflow-wrap: anywhere; }
            h2, h3 { font: 600 15px/1.4 'Bahnschrift', 'Segoe UI', 'Microsoft YaHei', sans-serif; }
            button, input, select { min-width: 0; max-width: 100%; font: inherit; }
            button {
                min-height: 36px; padding: 7px 12px; border: 1px solid var(--af3-border); border-radius: 9px;
                background: var(--af3-surface); color: var(--af3-ink); font-weight: 600;
                cursor: pointer; overflow-wrap: anywhere; line-height: 1.4;
                transition: background-color .15s, border-color .15s, box-shadow .15s;
            }
            button:hover:not(:disabled) { background: var(--af3-primary-soft); border-color: var(--af3-primary); }
            .af3-primary { background: var(--af3-primary); border-color: var(--af3-primary); color: #fff; }
            .af3-primary:hover:not(:disabled) { background: var(--af3-primary-hover); border-color: var(--af3-primary-hover); }
            .af3-danger { background: var(--af3-danger-soft); color: var(--af3-danger); border-color: #eac8cc; }
            .af3-danger:hover:not(:disabled) { background: var(--af3-danger); border-color: var(--af3-danger); color: #fff; }
            .af3-quiet { background: transparent; border-color: transparent; color: var(--af3-muted); padding-inline: 7px; }
            button:disabled { background: #eaf0f3; border-color: #e0e8ed; color: var(--af3-muted); cursor: not-allowed; box-shadow: none; }
            input:not([type="checkbox"]), select {
                display: block; width: 100%; min-height: 38px; padding: 7px 9px;
                background: var(--af3-surface); color: var(--af3-ink);
                border: 1px solid #a9bac6; border-radius: 8px; color-scheme: light;
            }
            input:disabled, select:disabled, input[readonly] { background: var(--af3-canvas); color: var(--af3-muted); }
            input[type="checkbox"] { accent-color: var(--af3-primary); width: 16px; height: 16px; margin: 3px 0 0; flex-shrink: 0; }
            :focus-visible { outline: 2px solid var(--af3-primary); outline-offset: 3px; }
            .af3-error-message {
                color: var(--af3-danger); background: var(--af3-danger-soft); border: 1px solid currentColor;
                border-radius: 8px; padding: 9px; font-weight: 600; animation: af3-error-pulse .8s ease-in-out 3;
            }
            @keyframes af3-error-pulse { 50% { box-shadow: inset 0 0 0 2px currentColor; } }
            @media (prefers-reduced-motion: reduce) { .af3-error-message { animation: none; } }

            #af3-header {
                display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding: 16px 16px 12px;
                background: var(--af3-surface); cursor: move; user-select: none;
            }
            .af3-wordmark {
                display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0;
                border-radius: 11px; background: var(--af3-primary-soft); color: var(--af3-primary);
                font: 600 17px/1 'Bahnschrift', 'Segoe UI', sans-serif; letter-spacing: -.7px;
            }
            .af3-header-copy { min-width: 0; flex: 1; }
            .af3-header-line { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; }
            #af3-header-title { font: 600 17px/1.3 'Bahnschrift', 'Segoe UI', 'Microsoft YaHei', sans-serif; overflow-wrap: anywhere; }
            .af3-version { display: block; margin-top: 3px; font: 11px/1.4 var(--af3-mono); color: var(--af3-muted); }
            .af3-navigation { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 0 16px 12px; background: var(--af3-surface); flex-shrink: 0; }
            .af3-tabs { display: flex; flex: 1; min-width: 0; padding: 3px; gap: 3px; border-radius: 10px; background: var(--af3-canvas); }
            .af3-tabs button { flex: 1; min-height: 32px; padding: 5px 8px; border-color: transparent; background: transparent; color: var(--af3-muted); }
            .af3-tabs button[aria-selected="true"] { background: var(--af3-surface); color: var(--af3-primary); box-shadow: 0 1px 4px #182f4017; }
            #af3-language-select { width: auto; max-width: 110px; min-height: 36px; font-size: 12px; padding: 5px 6px; border-color: var(--af3-border); }
            #af3-account-email {
                flex: 1 1 150px; min-width: 0; color: var(--af3-muted); font-size: 12px;
                display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; max-height: 3em; overflow: hidden;
            }
            .af3-workspace { overflow: auto; overscroll-behavior: contain; flex: 1; min-height: 0; padding: 14px 14px 30px; scrollbar-width: thin; scrollbar-color: #adbec8 transparent; }
            .af3-page { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
            .af3-card { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 14px; border: 1px solid var(--af3-border); border-radius: 13px; background: var(--af3-surface); }
            .af3-readiness { display: flex; align-items: center; gap: 7px; min-width: 0; color: var(--af3-muted); font-size: 13px; }
            .af3-status-dot { width: 7px; height: 7px; flex-shrink: 0; border-radius: 50%; background: currentColor; }
            #af3-submission-section { --af3-state-color: var(--af3-muted); --af3-state-bg: var(--af3-canvas); }
            #af3-submission-section[data-state="draft"], #af3-submission-section[data-state="running"] { --af3-state-color: var(--af3-primary); --af3-state-bg: var(--af3-primary-soft); }
            #af3-submission-section[data-state="failed"] { --af3-state-color: var(--af3-info); --af3-state-bg: var(--af3-info-soft); }
            #af3-submission-section[data-state="blocked"] { --af3-state-color: var(--af3-danger); --af3-state-bg: var(--af3-danger-soft); }
            #af3-submission-section[data-state="paused"] { --af3-state-color: var(--af3-warning); --af3-state-bg: var(--af3-warning-soft); }
            #af3-submission-status { padding: 7px 9px; border-radius: 8px; color: var(--af3-state-color); background: var(--af3-state-bg); }
            #af3-quota { color: var(--af3-muted); font-size: 13px; font-variant-numeric: tabular-nums; }
            .af3-submit-controls { display: grid; grid-template-columns: minmax(80px, 1fr) minmax(0, 1.5fr); gap: 10px; align-items: end; }
            .af3-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; color: var(--af3-muted); font-size: 12px; }
            .af3-field input, .af3-field select { font-size: 14px; }
            #af3-v20-count { font-weight: 600; font-variant-numeric: tabular-nums; }
            #af3-v20-btn { min-height: 38px; }
            #af3-run-controls { gap: 8px; flex-wrap: wrap; }
            #af3-run-controls button { flex: 1; }
            #af3-footer-msg { font-size: 12px; }
            #af3-footer-msg:not(.af3-error-message) { color: var(--af3-muted); }
            .af3-help, .af3-account-help, .af3-account-card time { font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
            .af3-help:not(.af3-error-message), .af3-account-help, .af3-account-card time { color: var(--af3-muted); }
            #af3-fasta-progress { display: block; width: 100%; height: 10px; accent-color: var(--af3-primary); }
            .af3-dates { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(135px, 100%), 1fr)); gap: 8px; }
            .af3-download-tools, .af3-download-actions, .af3-account-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
            .af3-batch-selection { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; max-width: 100%; }
            #af3-download-scan { margin-right: auto; }
            #af3-download-apply { width: 100%; }
            #af3-download-next { flex: 1; }
            #af3-download-queue { padding: 9px; border-radius: 8px; background: var(--af3-info-soft); color: var(--af3-info); font-size: 12px; }
            .af3-download-hint { padding-top: 10px; border-top: 1px solid var(--af3-border); }
            #af3-download-results { max-height: 240px; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; }
            #af3-download-results:empty { display: none; }
            .af3-day-group + .af3-day-group { margin-top: 8px; }
            .af3-day-heading { display: list-item; min-height: 36px; padding: 7px 8px; border-radius: 7px; background: var(--af3-canvas); font-size: 12px; font-weight: 600; cursor: pointer; }
            .af3-day-heading::marker { color: var(--af3-primary); }
            .af3-day-heading input[type="checkbox"] { margin: 0 8px 0 4px; vertical-align: middle; }
            .af3-job { display: flex; gap: 8px; align-items: start; padding: 8px; border-bottom: 1px solid var(--af3-border); cursor: pointer; overflow-wrap: anywhere; }
            .af3-job > span { min-width: 0; }
            .af3-job-name { display: block; font-size: 13px; }
            .af3-job-date { display: block; margin-top: 2px; color: var(--af3-muted); font: 11px/1.5 var(--af3-mono); }
            #af3-account-form { display: grid; gap: 8px; margin: 0; }
            #af3-account-form > label { color: var(--af3-muted); font-size: 12px; }
            #af3-accounts-message:empty { display: none; }
            #af3-accounts-message { font-size: 13px; }
            #af3-accounts-message:not(.af3-error-message) { padding: 10px; border: 1px solid #e9d6b1; border-radius: 9px; color: var(--af3-warning); background: var(--af3-warning-soft); }
            #af3-accounts-count { padding-inline: 2px; color: var(--af3-muted); font-size: 13px; }
            #af3-accounts-list { display: grid; gap: 10px; }
            #af3-accounts-list > p { padding: 12px; border: 1px dashed #adbec8; border-radius: 10px; color: var(--af3-muted); font-size: 13px; }
            .af3-account-card { display: grid; gap: 6px; padding: 12px; border: 1px solid var(--af3-border); border-radius: 12px; background: var(--af3-surface); min-width: 0; overflow-wrap: anywhere; }
            .af3-account-card:has(.af3-account-current) { border-left: 3px solid var(--af3-primary); }
            .af3-account-card strong { font-size: 13px; }
            .af3-account-card p { font-size: 13px; }
            .af3-account-current { justify-self: start; padding: 2px 7px; border-radius: 5px; background: var(--af3-primary-soft); color: var(--af3-primary); font-size: 11px; font-weight: 600; }
            .af3-account-live { color: var(--af3-primary); font-weight: 600; }
            .af3-account-history { color: var(--af3-muted); }
            .af3-account-actions button { font-size: 12px; }
            button[data-action="remove"] { color: var(--af3-danger); }
            #af3-log-toggle { width: 100%; min-height: 32px; display: flex; align-items: center; gap: 8px; padding: 4px; border: 0; background: transparent; color: var(--af3-muted); text-align: left; font-size: 12px; }
            #af3-log-toggle::before { content: '›'; font-size: 18px; line-height: 1; }
            #af3-log-toggle[aria-expanded="true"]::before { transform: rotate(90deg); }
            #af3-log-body { max-height: 160px; overflow: auto; margin: 6px 0 0; padding: 10px; border: 1px solid var(--af3-border); border-radius: 9px; background: var(--af3-surface); color: var(--af3-muted); white-space: pre-wrap; overflow-wrap: anywhere; font: 11px/1.6 var(--af3-mono); }
            #af3-resize-handle { position: absolute; right: 5px; bottom: 5px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; background: var(--af3-surface); color: var(--af3-muted); font: 18px/1 sans-serif; cursor: nwse-resize; user-select: none; touch-action: none; z-index: 1; }
            @container (max-width: 280px) {
                #af3-header { padding: 12px; } .af3-navigation { padding: 0 12px 10px; }
                .af3-tabs { flex-basis: 100%; } #af3-language-select { margin-left: auto; }
                .af3-workspace { padding: 10px 10px 30px; } .af3-card { padding: 11px; }
                .af3-dates { grid-template-columns: minmax(0, 1fr); }
            }
            @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        `;
        shadow.appendChild(styles);
        const container = document.createElement('div'); container.id = PANEL_ROOT_ID;
        const header = document.createElement('div'); header.id = 'af3-header';
        const headerCopy = document.createElement('div'); headerCopy.className = 'af3-header-copy';
        const headerLine = document.createElement('div'); headerLine.className = 'af3-header-line';
        const headerTitle = document.createElement('div'); headerTitle.id = 'af3-header-title'; headerTitle.textContent = t('headerTitle');
        const version = document.createElement('span'); version.className = 'af3-version'; version.textContent = `v${SCRIPT_VERSION}`;
        headerCopy.append(headerLine, version); header.append(headerCopy);
        const panelToggle = document.createElement('button'); panelToggle.id = 'af3-panel-toggle'; panelToggle.className = 'af3-wordmark'; panelToggle.type = 'button';
        panelToggle.setAttribute('aria-controls', 'af3-workspace');
        panelToggle.onmousedown = event => event.stopPropagation();
        panelToggle.onclick = () => {
            if (isRunning || fastaState.busy || downloadState.busy) return;
            host.toggleAttribute('data-collapsed'); updateDownloadControls();
        };
        header.prepend(panelToggle);

        const languageRow = document.createElement('div');
        languageRow.className = 'af3-navigation';
        const tabs = document.createElement('nav');
        tabs.className = 'af3-tabs'; tabs.setAttribute('role', 'tablist');
        for (const page of ['tasks', 'accounts']) {
            const tab = document.createElement('button');
            tab.id = `af3-${page}-tab`; tab.type = 'button'; tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', `af3-${page}-page`);
            tab.onclick = () => { activePage = page; renderPanelPages(); };
            tab.onkeydown = event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                activePage = event.key === 'Home' ? 'tasks' : event.key === 'End' ? 'accounts' : activePage === 'tasks' ? 'accounts' : 'tasks';
                renderPanelPages(); getUiElement(`af3-${activePage}-tab`).focus();
            };
            tabs.append(tab);
        }
        languageRow.appendChild(tabs);
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
        languageSelect.onchange = () => {
            currentLanguage = I18N[languageSelect.value] ? languageSelect.value : 'zh';
            saveLanguage(currentLanguage);
            applyLanguage();
        };
        languageRow.appendChild(languageSelect);

        const account = document.createElement('p');
        account.id = 'af3-account-email';
        account.setAttribute('role', 'status');
        account.setAttribute('aria-live', 'polite');
        account.textContent = t('accountUnknown');
        headerLine.append(headerTitle, account);

        const submission = document.createElement('section');
        submission.id = 'af3-submission-section';
        submission.setAttribute('aria-labelledby', 'af3-submission-title');
        submission.className = 'af3-card';
        const submissionTitle = document.createElement('h2');
        submissionTitle.id = 'af3-submission-title';
        submissionTitle.textContent = t('submitTitle');

        const statusRow = document.createElement('div');
        statusRow.id = 'af3-submission-status'; statusRow.className = 'af3-readiness';
        const statusLight = document.createElement('div');
        statusLight.id = 'af3-status-light';
        statusLight.className = 'af3-status-dot'; statusLight.setAttribute('aria-hidden', 'true');
        const statusText = document.createElement('span');
        statusText.id = 'af3-status-text';
        statusText.textContent = t('initializing');
        statusText.setAttribute('role', 'status');
        statusRow.appendChild(statusLight); statusRow.appendChild(statusText);

        const quota = document.createElement('p');
        quota.id = 'af3-quota';
        quota.setAttribute('role', 'status');
        quota.setAttribute('aria-live', 'polite');
        quota.textContent = t('quotaUnknown');

        const controls = document.createElement('div'); controls.className = 'af3-submit-controls';
        const countField = document.createElement('label'); countField.className = 'af3-field'; countField.htmlFor = 'af3-v20-count';
        const countLabel = document.createElement('span'); countLabel.id = 'af3-count-label'; countLabel.textContent = t('batchCount');
        const input = document.createElement('input');
        input.type = 'number'; input.value = '10'; input.id = 'af3-v20-count'; input.min = '1'; input.step = '1';
        countField.append(countLabel, input);
        const btn = document.createElement('button');
        btn.id = 'af3-v20-btn'; btn.type = 'button'; btn.className = 'af3-primary'; btn.textContent = t('startButton');
        btn.disabled = true; btn.onclick = mainProcess;
        controls.append(countField, btn);

        const runControls = document.createElement('div');
        runControls.id = 'af3-run-controls';
        runControls.style.display = 'none';

        const pauseBtn = document.createElement('button');
        pauseBtn.id = 'af3-pause-btn';
        pauseBtn.textContent = t('pauseButton');
        pauseBtn.type = 'button';
        pauseBtn.onclick = togglePause;

        const stopBtn = document.createElement('button');
        stopBtn.id = 'af3-stop-btn';
        stopBtn.textContent = t('stopButton');
        stopBtn.type = 'button'; stopBtn.className = 'af3-danger';
        stopBtn.onclick = requestStop;

        runControls.appendChild(pauseBtn);
        runControls.appendChild(stopBtn);

        const footer = document.createElement('div');
        footer.id = 'af3-footer-msg';
        footer.textContent = t('releaseHint');
        const logPanel = document.createElement('div');

        const logToggle = document.createElement('button');
        logToggle.id = 'af3-log-toggle';
        logToggle.type = 'button';
        logToggle.setAttribute('aria-controls', 'af3-log-body');
        logToggle.setAttribute('aria-expanded', 'false');
        logToggle.onclick = toggleLogPanel;

        const logBody = document.createElement('pre');
        logBody.id = 'af3-log-body';
        logBody.style.display = 'none';
        logPanel.appendChild(logToggle);
        logPanel.appendChild(logBody);

        container.appendChild(header); container.appendChild(languageRow);
        const tasksPage = document.createElement('div'); tasksPage.id = 'af3-tasks-page'; tasksPage.className = 'af3-page';
        tasksPage.setAttribute('role', 'tabpanel'); tasksPage.setAttribute('aria-labelledby', 'af3-tasks-tab');
        submission.append(submissionTitle, statusRow, quota, controls, runControls, footer);
        tasksPage.append(submission, createFastaSection(), createDownloadSection(), logPanel);
        const workspace = document.createElement('div'); workspace.id = 'af3-workspace'; workspace.className = 'af3-workspace';
        workspace.append(tasksPage, createAccountPage()); container.appendChild(workspace);
        shadow.appendChild(container);
        const resizeHandle = document.createElement('span');
        resizeHandle.id = 'af3-resize-handle';
        resizeHandle.setAttribute('role', 'button');
        resizeHandle.tabIndex = 0;
        resizeHandle.textContent = '↘';
        resizeHandle.title = t('resizePanel');
        resizeHandle.setAttribute('aria-label', t('resizePanel'));
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
        updateAccountEmail();
        updateQuota();
        updateDownloadControls();
        renderFastaSection();
        const btn = getUiElement('af3-v20-btn');
        const light = getUiElement('af3-status-light');
        const text = getUiElement('af3-status-text');
        const footer = getUiElement('af3-footer-msg');
        const section = getUiElement('af3-submission-section');

        if (!btn || !light || !text || isRunning) return;

        if (submissionBlockReason) {
            btn.disabled = true;
            btn.textContent = t('submissionLocked');
            section.dataset.state = 'blocked';
            text.textContent = t('submissionLocked');
            showMessageError(footer, true, submissionBlockReason);
            return;
        }

        const selected = getSelectedHistoryStatuses();
        const status = !downloadState.busy && !fastaState.busy && selected.length === 1 ? selected[0] : '';
        let help;

        if (status === 'saved draft') {
            currentMode = 'DRAFT';
            section.dataset.state = 'draft';
            text.textContent = t('readyDraftStatus');
            help = t('modeDraftFooter');
            btn.disabled = false;
        } else if (status === 'failed') {
            currentMode = 'FAILED';
            section.dataset.state = 'failed';
            text.textContent = t('readyFailedStatus');
            help = t('modeFailedFooter');
            btn.disabled = false;
        } else {
            currentMode = 'NONE';
            section.dataset.state = 'standby';
            text.textContent = t('standbyStatus');
            help = t('standbyFooter');
            btn.disabled = true;
        }
        const error = runProgress.status === 'error';
        showMessageError(footer, error, error ? runProgress.detail || t('batchError') : help);
    }

    // --- 主入口 ---
    async function mainProcess() {
        if (isRunning || downloadState.busy || fastaState.busy || submissionBlockReason) return;
        checkSystemStatus();
        const mode = currentMode;
        const account = normalizeAccountEmail(readAccountEmail());
        if (mode !== 'DRAFT' && mode !== 'FAILED') return;

        const countInput = getUiElement('af3-v20-count');
        const requestedJobs = parseInt(countInput.value, 10) || 10;
        const maxJobs = confirmStart(requestedJobs);
        if (!maxJobs) return;
        checkSystemStatus();
        if (currentMode !== mode || normalizeAccountEmail(readAccountEmail()) !== account) return;

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
                await submitAndConfirm(confirmBtn, draftIdentity);
                addLog(t('draftDone', { index: i }));
                recordProgressResult('success');
                await recordFastaSubmission(draftIdentity);
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
        renderFastaSection();
        updateAccountSwitchControl();
        batchAccountEmail = state ? normalizeAccountEmail(readAccountEmail()) : null;
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
        if (isRunning) {
            const section = getUiElement('af3-submission-section');
            if (section) section.dataset.state = isPaused ? 'paused' : 'running';
            const status = getUiElement('af3-status-text');
            if (status) status.textContent = t(shouldStop ? 'stoppingButton' : isPaused ? 'pausedButton' : 'runningButton');
        }
        if (pauseBtn) {
            pauseBtn.textContent = isPaused ? t('resumeButton') : t('pauseButton');
            pauseBtn.classList.toggle('af3-primary', isPaused);
            pauseBtn.disabled = !isRunning || shouldStop;
        }
        if (stopBtn) {
            stopBtn.disabled = !isRunning || shouldStop;
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
        window.addEventListener('storage', event => {
            if (event.key !== ACCOUNTS_KEY && event.key !== null) return;
            accountRecords = loadAccounts();
            renderAccountManager();
        });
        if (typeof GM_addValueChangeListener === 'function') {
            GM_addValueChangeListener(ACCOUNTS_KEY, (_key, _oldValue, _newValue, remote) => {
                if (!remote) return;
                accountRecords = loadAccounts();
                renderAccountManager();
            });
        }
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
