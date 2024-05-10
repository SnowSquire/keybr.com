import { keyboardProps, type KeyId, Ngram2 } from "@keybr/keyboard";
import { type Lesson, type LessonKeys, lessonProps } from "@keybr/lesson";
import { Histogram, KeySet } from "@keybr/math";
import {
  computeDailyGoal,
  type DailyGoal,
  type KeyStatsMap,
  LocalDate,
  newSummaryStats,
  Result,
  ResultGroups,
  type SummaryStats,
} from "@keybr/result";
import { type Settings } from "@keybr/settings";
import {
  type Feedback,
  type LineList,
  newStats,
  type Step,
  type TextDisplaySettings,
  TextInput,
  type TextInputSettings,
  toTextDisplaySettings,
  toTextInputSettings,
} from "@keybr/textinput";
import { type TextInputEvent } from "@keybr/textinput-events";
import { type CodePoint, type HasCodePoint } from "@keybr/unicode";

export type LastLesson = {
  readonly result: Result;
  readonly hits: Histogram<HasCodePoint>;
  readonly misses: Histogram<HasCodePoint>;
  readonly hits2: Ngram2;
  readonly misses2: Ngram2;
};

export class PracticeState {
  readonly showTour: boolean;
  readonly textInputSettings: TextInputSettings;
  readonly textDisplaySettings: TextDisplaySettings;
  readonly keyStatsMap: KeyStatsMap;
  readonly lessonKeys: LessonKeys;
  readonly stats: SummaryStats;
  readonly dailyGoal: DailyGoal;

  lastLesson: LastLesson | null = null;

  textInput!: TextInput; // Mutable.
  lines!: LineList; // Mutable.
  suffix!: readonly CodePoint[]; // Mutable.
  depressedKeys: readonly KeyId[] = []; // Mutable.

  constructor(
    readonly settings: Settings,
    readonly lesson: Lesson,
    readonly results: readonly Result[],
    readonly appendResult: (result: Result) => void,
  ) {
    this.showTour = settings.isNew;
    this.textInputSettings = toTextInputSettings(settings);
    this.textDisplaySettings = toTextDisplaySettings(settings);
    this.keyStatsMap = this.lesson.analyze(this.results);
    this.lessonKeys = this.lesson.update(this.keyStatsMap);
    this.stats = newSummaryStats(results);
    this.dailyGoal = computeDailyGoal(
      ResultGroups.byDate(results).get(LocalDate.now()),
      settings.get(lessonProps.dailyGoal),
    );
    this.#reset(this.lesson.generate(this.lessonKeys));
  }

  resetLesson(): void {
    this.#reset(this.textInput.text);
  }

  skipLesson(): void {
    this.#reset(this.lesson.generate(this.lessonKeys));
  }

  onTextInput(event: TextInputEvent): Feedback {
    const feedback = this.textInput.onTextInput(event);
    this.lines = this.textInput.lines;
    this.suffix = this.textInput.suffix;
    if (this.textInput.completed) {
      this.appendResult(
        Result.fromStats(
          this.settings.get(keyboardProps.layout),
          this.settings.get(lessonProps.type).textType,
          Date.now(),
          newStats(this.textInput.steps),
        ),
      );
    }
    return feedback;
  }

  #reset(fragment: string): void {
    this.textInput = new TextInput(fragment, this.textInputSettings);
    this.lines = this.textInput.lines;
    this.suffix = this.textInput.suffix;
  }
}

export function makeLastLesson(
  result: Result,
  steps: readonly Step[],
): LastLesson {
  const keySet = new KeySet<HasCodePoint>([]);
  const hits = new Histogram(keySet);
  const misses = new Histogram(keySet);
  for (const { codePoint, hitCount, missCount } of result.histogram) {
    hits.set({ codePoint }, hitCount);
    misses.set({ codePoint }, missCount);
  }
  const alphabet = [...new Set(steps.map(({ codePoint }) => codePoint))].sort(
    (a, b) => a - b,
  );
  const hits2 = new Ngram2(alphabet);
  const misses2 = new Ngram2(alphabet);
  for (let i = 0; i < steps.length - 1; i++) {
    hits2.add(steps[i].codePoint, steps[i + 1].codePoint, 1);
  }
  return { result, hits, misses, hits2, misses2 };
}
