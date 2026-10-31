export type Locale = 'en' | 'bn';

export interface Translations {
  appName: string;
  appBadge: string;
  appSubtitle: string;
  nav: {
    practice: string;
    simulator: string;
    vault: string;
    langToggle: string;
  };
  metrics: {
    netScore: string;
    accuracy: string;
    penaltyLost: string;
    streak: string;
    days: string;
    timeRemaining: string;
    pace: string;
    attempted: string;
    unattempted: string;
  };
  filter: {
    examShard: string;
    facets: string;
    resetFilters: string;
    questionsLoaded: string;
    allSubjects: string;
    noQuestionsMatch: string;
    clearFilters: string;
  };
  subjects: {
    MATH: string;
    ENGLISH: string;
    ANALYTICAL: string;
    COMPUTER_ICT: string;
    GENERAL_KNOWLEDGE: string;
  };
  card: {
    questionLabel: string;
    of: string;
    bookmark: string;
    bookmarked: string;
    aiExplain: string;
    nextQuestion: string;
    previous: string;
    jumpTo: string;
    shortcutHelp: string;
  };
  explain: {
    facultyTitle: string;
    coreConcept: string;
    examShortcut: string;
    stepByStep: string;
    optionDiagnostics: string;
    correctLogic: string;
    trapDiagnosis: string;
    officialAnswer: string;
    distractorTrap: string;
    retry: string;
    diagnosticFor: string;
  };
  simulator: {
    title: string;
    subtitle: string;
    duration: string;
    durationVal: string;
    targetPerMcq: string;
    targetPerMcqVal: string;
    penalty: string;
    penaltyVal: string;
    beginButton: string;
    submitExam: string;
    completedTitle: string;
    formula: string;
    totalQuestions: string;
    correctAnswers: string;
    wrongAnswers: string;
    estimatedPercentile: string;
    retake: string;
    paletteTitle: string;
  };
  vault: {
    title: string;
    tagline: string;
    graduationRule: string;
    pristineTitle: string;
    pristineMsg: string;
    failedCount: string;
    streakProgress: string;
    queueTitle: string;
    item: string;
    emptySelection: string;
  };
}

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: {
    appName: 'BankIntel',
    appBadge: 'PWA',
    appSubtitle: 'Bangladesh Bank & BSC MCQ Intelligence Platform',
    nav: {
      practice: 'Practice',
      simulator: 'Simulator',
      vault: 'Mistake Vault',
      langToggle: 'বাংলা',
    },
    metrics: {
      netScore: 'Net Score (-0.25)',
      accuracy: 'Accuracy',
      penaltyLost: 'Penalty Lost',
      streak: 'Daily Streak',
      days: 'Days',
      timeRemaining: 'Time Remaining',
      pace: 'Pace',
      attempted: 'Answered',
      unattempted: 'Unattempted',
    },
    filter: {
      examShard: 'Target Question Bank',
      facets: 'Subject Facets:',
      resetFilters: 'Reset filters',
      questionsLoaded: 'Questions Loaded',
      allSubjects: 'All Subjects',
      noQuestionsMatch: 'No questions match the selected filters.',
      clearFilters: 'Clear Subject Filters',
    },
    subjects: {
      MATH: 'Mathematics',
      ENGLISH: 'English',
      ANALYTICAL: 'Analytical Ability',
      COMPUTER_ICT: 'Computer & ICT',
      GENERAL_KNOWLEDGE: 'General Knowledge',
    },
    card: {
      questionLabel: 'Question',
      of: 'of',
      bookmark: 'Bookmark to Vault',
      bookmarked: 'Saved in Vault',
      aiExplain: 'AI Explain [E]',
      nextQuestion: 'Next Question',
      previous: 'Previous',
      jumpTo: 'Question',
      shortcutHelp: 'Keys: [1-4] Select • [E] AI Explain • [Space/→] Next',
    },
    explain: {
      facultyTitle: 'IBA/BIBM Exam Faculty Deep Diagnostics',
      coreConcept: 'Core Axiom / Principle',
      examShortcut: '<30s Exam Hall Shortcut & Elimination Trick',
      stepByStep: 'Step-by-Step Derivation',
      optionDiagnostics: 'Option Trap Diagnostics Selector',
      correctLogic: 'Correct Solution Logic',
      trapDiagnosis: 'Distractor & Trap Diagnosis',
      officialAnswer: 'Official Answer',
      distractorTrap: 'Distractor Trap',
      retry: 'Retry Generation',
      diagnosticFor: 'Diagnostic for Option',
    },
    simulator: {
      title: 'Bangladesh Bank AD 60-Minute Simulator',
      subtitle:
        'Official BIBM Examination Conditions: 100 MCQs in 60 minutes with strict -0.25 negative marking.',
      duration: 'Duration',
      durationVal: '60 Minutes',
      targetPerMcq: 'Pace Target',
      targetPerMcqVal: '36 Seconds/MCQ',
      penalty: 'Negative Penalty',
      penaltyVal: '-0.25 Points',
      beginButton: 'Begin Official Simulation',
      submitExam: 'Submit Exam',
      completedTitle: 'Simulation Completed',
      formula: 'Official Scoring: (Correct × 1.0) - (Wrong × 0.25)',
      totalQuestions: 'Total Questions:',
      correctAnswers: 'Correct Answers (+1.00 each):',
      wrongAnswers: 'Wrong Answers (-0.25 penalty each):',
      estimatedPercentile: 'Exam Ranking Tier:',
      retake: 'Retake Simulation',
      paletteTitle: 'Question Navigation Palette',
    },
    vault: {
      title: 'Mistake Vault',
      tagline: 'Spaced Error Revision Engine',
      graduationRule:
        'Rule: Answer weak questions correctly 3 consecutive times to auto-graduate them.',
      pristineTitle: 'Mistake Vault is Pristine',
      pristineMsg:
        'You currently have zero active error items or all weak questions have graduated after 3 consecutive correct repetitions!',
      failedCount: 'Failed',
      streakProgress: 'Graduation Streak',
      queueTitle: 'Target Revision Queue',
      item: 'Question',
      emptySelection: 'Select a question from the revision queue to drill.',
    },
  },
  bn: {
    appName: 'ব্যাংক-ইনটেল',
    appBadge: 'পিডব্লিউএ',
    appSubtitle: 'বাংলাদেশ ব্যাংক ও বিএসসি এমসিকিউ ইনটেলিজেন্স প্ল্যাটফর্ম',
    nav: {
      practice: 'অনুশীলন',
      simulator: 'সিমুলেটর',
      vault: 'ভুল ব্যাংক',
      langToggle: 'English',
    },
    metrics: {
      netScore: 'নেট স্কোর (-০.২৫)',
      accuracy: 'সঠিকতার হার',
      penaltyLost: 'পেনাল্টি কর্তন',
      streak: 'ধারাবাহিকতা',
      days: 'দিন',
      timeRemaining: 'বাকি সময়',
      pace: 'গতি',
      attempted: 'উত্তরকৃত',
      unattempted: 'বাকি আছে',
    },
    filter: {
      examShard: 'পরীক্ষার প্রশ্নব্যাংক নির্বাচন',
      facets: 'বিষয়ভিত্তিক ফিল্টার:',
      resetFilters: 'ফিল্টার রিসেট',
      questionsLoaded: 'টি প্রশ্ন প্রস্তুত',
      allSubjects: 'সকল বিষয়',
      noQuestionsMatch: 'নির্বাচিত ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি।',
      clearFilters: 'ফিল্টার বাতিল করুন',
    },
    subjects: {
      MATH: 'গণিত',
      ENGLISH: 'ইংরেজি',
      ANALYTICAL: 'মানসিক দক্ষতা',
      COMPUTER_ICT: 'কম্পিউটার ও আইসিটি',
      GENERAL_KNOWLEDGE: 'সাধারণ জ্ঞান',
    },
    card: {
      questionLabel: 'প্রশ্ন',
      of: 'এর মধ্যে',
      bookmark: 'ভুল ব্যাংকে সংরক্ষণ',
      bookmarked: 'সংরক্ষিত আছে',
      aiExplain: 'এআই ব্যাখ্যা [E]',
      nextQuestion: 'পরবর্তী প্রশ্ন',
      previous: 'পূর্ববর্তী',
      jumpTo: 'প্রশ্ন নং',
      shortcutHelp: 'শর্টকাট: [১-৪] অপশন • [E] এআই ব্যাখ্যা • [Space/→] পরবর্তী',
    },
    explain: {
      facultyTitle: 'আইবিএ ও বিআইবিএম অনুষদ ভিত্তিক গভীর বিশ্লেষণ',
      coreConcept: 'মূল সূত্র ও মৌলিক ধারণা',
      examShortcut: '৩০-সেকেন্ডের পরীক্ষার হল শর্টকাট ও অপশন বর্জন কৌশল',
      stepByStep: 'ধাপে ধাপে বিস্তারিত সমাধান',
      optionDiagnostics: 'প্রতিটি অপশনের ফাঁদ ও ভুলের কারণ',
      correctLogic: 'সঠিক উত্তরের যুক্তি',
      trapDiagnosis: 'পরীক্ষার্থীদের সাধারণ ভুল ও বিভ্রান্তিকর ফাঁদ',
      officialAnswer: 'অফিসিয়াল সঠিক উত্তর',
      distractorTrap: 'ভ্রান্তিকর অপশন (Trap)',
      retry: 'পুনরায় বিশ্লেষণ তৈরি করুন',
      diagnosticFor: 'অপশন নির্ণয়',
    },
    simulator: {
      title: 'বাংলাদেশ ব্যাংক এডি ৬০-মিনিট এক্সাম সিমুলেটর',
      subtitle:
        'অফিসিয়াল বিআইবিএম পরীক্ষার নিয়ম: ৬০ মিনিটে ১০০টি এমসিকিউ এবং প্রতি ভুলের জন্য -০.২৫ নম্বর কর্তন।',
      duration: 'সময়সীমা',
      durationVal: '৬০ মিনিট',
      targetPerMcq: 'প্রতি প্রশ্নের গড় সময়',
      targetPerMcqVal: '৩৬ সেকেন্ড',
      penalty: 'নেগেটিভ মার্কিং',
      penaltyVal: '-০.২৫ নম্বর',
      beginButton: 'অফিসিয়াল পরীক্ষা শুরু করুন',
      submitExam: 'পরীক্ষা জমা দিন',
      completedTitle: 'সিমুলেশন সম্পন্ন হয়েছে',
      formula: 'অফিসিয়াল হিসাব: (সঠিক × ১.০) - (ভুল × ০.২৫)',
      totalQuestions: 'মোট প্রশ্ন:',
      correctAnswers: 'সঠিক উত্তর (+১.০০ প্রতিটিতে):',
      wrongAnswers: 'ভুল উত্তর (-০.২৫ পেনাল্টি প্রতিটিতে):',
      estimatedPercentile: 'সম্ভাব্য মেধা তালিকা:',
      retake: 'পুনরায় পরীক্ষা দিন',
      paletteTitle: 'প্রশ্ন নেভিগেশন প্যালেট',
    },
    vault: {
      title: 'ভুল ব্যাংক (Mistake Vault)',
      tagline: 'দুর্বলতা দূরীকরণ ও স্পেসড রিভিশন ইঞ্জিন',
      graduationRule:
        'নিয়ম: যে প্রশ্নগুলোতে ভুল করেছিলেন সেগুলো টানা ৩ বার নির্ভুল উত্তর দিলে স্বয়ংক্রিয়ভাবে গ্র্যাজুয়েট হবে।',
      pristineTitle: 'ভুল ব্যাংক সম্পূর্ণ খালি!',
      pristineMsg:
        'অভিনন্দন! আপনার কোনো অনিষ্পন্ন ভুল প্রশ্ন নেই অথবা সব দুর্বল প্রশ্ন ৩ বার সঠিক উত্তরের মাধ্যমে গ্র্যাজুয়েট হয়েছে।',
      failedCount: 'ভুল হয়েছে',
      streakProgress: 'গ্র্যাজুয়েশন অগ্রগতি',
      queueTitle: 'রিভিশন তালিকা',
      item: 'প্রশ্ন',
      emptySelection: 'অনুশীলন করতে ডানপাশের তালিকা থেকে একটি প্রশ্ন নির্বাচন করুন।',
    },
  },
};
