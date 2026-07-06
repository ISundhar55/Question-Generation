import { QuestionCreator } from './QuestionCreator';
import { QuestionPreview } from './QuestionPreview';
import { MCQQuestion } from './MCQQuestion';
import { TrueFalseQuestion } from './TrueFalseQuestion';
import { ShortAnswerQuestion } from './ShortAnswerQuestion';
import { FillBlankQuestion } from './FillBlankQuestion';
import './styles.css';

// ─── MCQ ────────────────────────────────────────────────
export default { title: 'Question Components' };

export const MCQ = () => (
  <div style={{ padding: 24, maxWidth: 600 }}>
    <MCQQuestion
      question="What is the powerhouse of the cell?"
      options={['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi Apparatus']}
      correctAnswer="Mitochondria"
      mode="preview"
    />
  </div>
);

export const TrueFalse = () => (
  <div style={{ padding: 24, maxWidth: 600 }}>
    <TrueFalseQuestion
      question="The Great Wall of China is visible from space."
      correctAnswer="false"
      mode="preview"
    />
  </div>
);

export const ShortAnswer = () => (
  <div style={{ padding: 24, maxWidth: 600 }}>
    <ShortAnswerQuestion
      question="Explain the process of photosynthesis in your own words."
      correctAnswer="Photosynthesis is the process by which plants use sunlight, water, and CO2 to produce oxygen and energy in the form of glucose."
      mode="preview"
    />
  </div>
);

export const FillInBlank = () => (
  <div style={{ padding: 24, maxWidth: 600 }}>
    <FillBlankQuestion
      questionTemplate="The capital of France is ___ and it is famous for the ___ Tower."
      correctAnswers={['Paris', 'Eiffel']}
      mode="preview"
    />
  </div>
);

export const Creator = () => (
  <div style={{ padding: 24, maxWidth: 700 }}>
    <QuestionCreator
      onSave={(data) => alert(JSON.stringify(data, null, 2))}
      onClose={() => alert('Close clicked')}
      onPreview={(data) => alert('Preview: ' + JSON.stringify(data, null, 2))}
    />
  </div>
);

export const Preview = () => (
  <div style={{ padding: 24, maxWidth: 600 }}>
    <QuestionPreview
      question={{
        type: 'MCQ',
        text: 'Which planet is closest to the Sun?',
        options: ['Venus', 'Mercury', 'Earth', 'Mars'],
        answer: 'Mercury',
        difficulty: 'easy',
        points: 2,
      }}
      onBack={() => alert('Back clicked')}
    />
  </div>
);
