(function exposeUiPreferences(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Top1UI = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createUiPreferences() {
  const zh = {
    "Driver OS": "司机操作系统",
    "Today": "今天",
    "Execution": "执行",
    "Profit": "利润",
    "Secure Access": "安全登录",
    "Welcome back": "欢迎回来",
    "Account ID or Email": "账号或电子邮箱",
    "Password": "密码",
    "Enter Driver OS": "进入司机系统",
    "Create Driver Account": "创建司机账号",
    "Presentation Demo": "演示账号",
    "Private workspace": "私人工作空间",
    "Secure cloud sync": "安全云端同步",
    "Your data only": "仅限你的资料",
    "Private workspace · Secure cloud sync · Your data only": "私人工作空间 · 安全云端同步 · 仅限你的资料",
    "Your Name": "你的名字",
    "Email": "电子邮箱",
    "Back to Sign In": "返回登录",
    "Create your own private Driver workspace.": "创建你自己的私人司机工作空间。",
    "Your time, income and daily execution in one private operating system.": "在一个私人操作系统中管理你的时间、收入与每日执行。",
    "Today Command Center": "今日指挥中心",
    "Grab Profit Calendar": "司机利润日历",
    "Solar Appointment": "太阳能预约",
    "Grab Daily Record": "每日司机记录",
    "Monthly Operations": "每月营运",
    "Previous month": "上个月",
    "Next month": "下个月",
    "Mon": "周一",
    "Tue": "周二",
    "Wed": "周三",
    "Thu": "周四",
    "Fri": "周五",
    "Sat": "周六",
    "Sun": "周日",
    "Light": "浅色",
    "Dark": "深色",
    "Log out": "退出登录",
    "Car Rental": "汽车租金",
    "Housing Loan": "房屋贷款",
    "Pocket Money": "零用钱",
    "Weekly Net": "本周净利润",
    "First weekly achievement": "本周第一个目标",
    "Second achievement": "第二个目标",
    "After weekly achievements": "完成每周目标后",
    "Completed": "已完成",
    "Rest": "休息",
    "Finished": "已完成",
    "In Progress": "进行中",
    "Selected Day": "所选日期",
    "Status": "状态",
    "Net Profit": "净利润",
    "Income/hour": "每小时收入",
    "Trips": "行程数",
    "Date": "日期",
    "Driving Sessions": "驾驶时段",
    "Starting": "开始余额",
    "Ending": "结束余额",
    "Ending Before Withdrawal": "提现前结束余额",
    "Wallet Base": "钱包基准",
    "Auto Transfer To Bank": "自动转入银行",
    "Cash / Petrol / Trips": "现金 / 汽油 / 行程",
    "Cash Collected Today": "今日收到现金",
    "Amount": "金额",
    "Station": "油站",
    "Payment": "付款方式",
    "Total Trips": "总行程数",
    "Grab Wallet Top-Up Cost": "Grab钱包补充值成本",
    "Remark": "备注",
    "Temporarily Save": "暂时保存",
    "Finish Today": "完成今天",
    "View Daily Summary": "查看每日总结",
    "Existing Record": "已有记录",
    "Saved": "已保存",
    "Cash Position": "现金状况",
    "Petty Cash": "随身现金",
    "Cash At Home": "家中现金",
    "Total Cash": "现金总额",
    "No pending cash confirmations for this date.": "此日期没有待确认现金。",
    "Cash Tools": "现金工具",
    "Petty Cash Opening": "随身现金期初",
    "Cash At Home Opening": "家中现金期初",
    "Car Rental Target": "汽车租金目标",
    "Housing Loan Target": "房屋贷款目标",
    "Grab Wallet Base": "Grab钱包基准",
    "Save Settings": "保存设置",
    "Move / Withdraw Cash": "转移 / 提取现金",
    "Action": "操作",
    "Move Petty Cash to Home": "将随身现金转到家中",
    "Withdraw From Petty Cash": "从随身现金提取",
    "Withdraw From Cash At Home": "从家中现金提取",
    "Category": "类别",
    "Record Cash Action": "记录现金操作",
    "Bank Transfer": "银行转账",
    "Cash History": "现金记录",
    "Petrol Credit Card": "汽油信用卡",
    "Week Cost": "本周成本",
    "Month Cost": "本月成本",
    "Card Charged": "信用卡消费",
    "Paid": "已还款",
    "Payment Date": "还款日期",
    "Pay Amount": "还款金额",
    "Note": "备注",
    "Payment": "还款",
    "Pay Petrol Card": "偿还汽油信用卡",
    "No petrol card payment yet.": "还没有汽油信用卡还款记录。",
    "Weekly Statistics": "每周统计",
    "Grab Intelligence": "司机营运分析",
    "Week Net": "本周净利润",
    "Month Net": "本月净利润",
    "Income Breakdown": "收入明细",
    "Cost Breakdown": "成本明细",
    "Imported Summary": "导入汇总",
    "Driver Console": "司机控制台",
    "No driver record yet": "还没有司机记录",
    "Cash": "现金",
    "TNG QR": "TNG二维码",
    "Grab Wallet": "Grab钱包",
    "Petrol": "汽油",
    "Toll": "过路费",
    "Grab Wallet Top-Up": "Grab钱包补充值",
    "Credit Card": "信用卡",
    "Points / Rewards": "积分 / 奖励",
    "Other": "其他",
    "Legacy / Settled": "历史记录 / 已结清",
    "Update record?": "更新记录？",
    "Cancel": "取消",
    "Update Existing Record": "更新已有记录",
    "Daily Summary": "每日总结",
    "Total Income": "总收入",
    "Driving Hours": "驾驶小时",
    "Income / Hour": "每小时收入",
    "Total Cost": "总成本",
    "Income": "收入",
    "Cost": "成本",
    "Cash Collected": "收到现金",
    "TNG eWallet": "TNG电子钱包",
    "Grab Cash Wallet": "Grab现金钱包",
    "Toll / SmartTAG": "过路费 / SmartTAG",
    "Cash Movement": "现金变化",
    "Previous Total Cash": "之前现金总额",
    "Today's Cash": "今日现金",
    "New Total Cash": "新的现金总额",
    "Confirm": "确认",
    "No bank transfer confirmed yet.": "还没有确认的银行转账。",
    "No cash ledger entries yet.": "还没有现金记录。",
    "This week": "本周",
    "This month": "本月",
    "This week / this month": "本周 / 本月",
    "Based on total income": "根据总收入计算",
    "Update Solar Lead": "更新太阳能客户",
    "Save Solar Lead": "保存太阳能客户",
    "Clear": "清除",
    "Solar History": "太阳能记录",
    "Customer Name": "客户姓名",
    "Phone": "电话",
    "Address": "地址",
    "Postcode": "邮政编码",
    "Area": "地区",
    "Appointment Date": "预约日期",
    "Appointment Time": "预约时间",
    "Phase Type": "电力相位",
    "Battery Units": "电池数量",
    "System Size": "系统容量",
    "Financing": "融资方式",
    "New": "新客户",
    "Appointed": "已预约",
    "Closed": "成交",
    "Lost": "未成交",
    "Edit": "编辑",
    "Delete": "删除",
    "Account ID or password is incorrect.": "账号或密码不正确。",
    "Use isaac, demo, or your registered email.": "请输入 isaac、demo 或你注册的电子邮箱。",
    "Verifying secure access...": "正在验证安全登录...",
    "Creating your workspace...": "正在创建你的工作空间...",
    "Account created. Check your email if confirmation is required.": "账号已创建。如需要验证，请检查电子邮箱。",
    "Unable to sign in.": "无法登录。",
    "Swipe to explore": "左右滑动查看"
  };

  const reverseZh = Object.fromEntries(Object.entries(zh).map(([en, value]) => [value, en]));

  function normalizeLanguage(language) {
    return language === "zh-CN" ? "zh-CN" : "en";
  }

  function localeForLanguage(language) {
    return normalizeLanguage(language) === "zh-CN" ? "zh-CN" : "en-MY";
  }

  function createTranslator(language) {
    const normalized = normalizeLanguage(language);
    return value => {
      const text = String(value ?? "");
      if (normalized === "zh-CN") return zh[text] || text;
      return reverseZh[text] || text;
    };
  }

  function canAccessSolar(accountType) {
    return accountType === "owner";
  }

  function translateText(text, language) {
    const leading = text.match(/^\s*/)?.[0] || "";
    const trailing = text.match(/\s*$/)?.[0] || "";
    const core = text.trim();
    if (!core) return text;
    const translate = createTranslator(language);
    let translated = translate(core);
    if (language === "zh-CN" && translated === core) {
      translated = core
        .replace(/\bFinished\b/g, "已完成")
        .replace(/\bIn Progress\b/g, "进行中")
        .replace(/\bRest\b/g, "休息")
        .replace(/\bincome\b/g, "收入")
        .replace(/\btrips\b/g, "行程")
        .replace(/\bmonth net\b/g, "本月净利润")
        .replace(/\bevents\b/g, "事件")
        .replace(/\btasks\b/g, "任务")
        .replace(/^Session (\d+) Start$/, "时段 $1 开始")
        .replace(/^Session (\d+) End$/, "时段 $1 结束")
        .replace(/^Petrol (\d+)$/, "汽油 $1")
        .replace(/^This week (.+)$/, "本周 $1")
        .replace(/^This month (.+)$/, "本月 $1")
        .replace(/^(.+) outstanding$/, "未还款 $1")
        .replace(/ · Payment$/, " · 还款");
    } else if (language === "en" && translated === core) {
      translated = core
        .replace(/已完成/g, "Finished")
        .replace(/进行中/g, "In Progress")
        .replace(/休息/g, "Rest")
        .replace(/收入/g, "income")
        .replace(/行程/g, "trips")
        .replace(/本月净利润/g, "month net")
        .replace(/事件/g, "events")
        .replace(/任务/g, "tasks")
        .replace(/^时段 (\d+) 开始$/, "Session $1 Start")
        .replace(/^时段 (\d+) 结束$/, "Session $1 End")
        .replace(/^汽油 (\d+)$/, "Petrol $1")
        .replace(/^本周 (.+)$/, "This week $1")
        .replace(/^本月 (.+)$/, "This month $1")
        .replace(/^未还款 (.+)$/, "$1 outstanding")
        .replace(/ · 还款$/, " · Payment");
    }
    return `${leading}${translated}${trailing}`;
  }

  function applyTranslations(root, language) {
    if (!root || typeof document === "undefined") return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return;
      node.nodeValue = translateText(node.nodeValue, language);
    });
    root.querySelectorAll("[placeholder]").forEach(node => {
      node.placeholder = translateText(node.placeholder, language);
    });
    root.querySelectorAll("[aria-label]").forEach(node => {
      node.setAttribute("aria-label", translateText(node.getAttribute("aria-label"), language));
    });
    document.documentElement.lang = language === "zh-CN" ? "zh-CN" : "en";
  }

  return {
    applyTranslations,
    canAccessSolar,
    createTranslator,
    localeForLanguage,
    normalizeLanguage,
    translateText
  };
}));
