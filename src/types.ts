export interface Paragraph {
  en: string
  zh: string
}

export interface Question {
  number: number
  text: string
  options: string[]
}

export interface Passage {
  id: string
  year: number
  exam: 'english-1' | 'english-2'
  textNumber: number
  title: string
  subtitle?: string
  source?: string
  paragraphs: Paragraph[]
  questions: Question[]
  vocabulary: Record<string, string>
}

export interface YearGroup {
  year: number
  exams: {
    type: 'english-1' | 'english-2'
    label: string
    passages: Passage[]
  }[]
}
