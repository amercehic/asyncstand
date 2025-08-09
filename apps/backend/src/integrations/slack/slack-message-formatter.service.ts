import { Injectable } from '@nestjs/common';
import { Block, KnownBlock } from '@slack/web-api';
import { SlackModalView } from '@/integrations/slack/slack-messaging.service';

interface StandupInstance {
  id: string;
  targetDate: Date;
  state: string;
  configSnapshot: {
    questions: string[];
    responseTimeoutHours: number;
    participatingMembers: Array<{
      id: string;
      name: string;
      platformUserId: string;
    }>;
  };
  team?: {
    name: string;
  };
}

interface MemberAnswer {
  teamMemberId: string;
  memberName: string;
  answers: Array<{
    questionIndex: number;
    answer: string;
  }>;
  isComplete: boolean;
}

interface ParticipationStats {
  totalMembers: number;
  respondedMembers: number;
  responseRate: number;
  missingMembers: string[];
}

@Injectable()
export class SlackMessageFormatterService {
  formatStandupReminder(
    instance: StandupInstance,
    teamName: string,
  ): { text: string; blocks: (Block | KnownBlock)[] } {
    const { questions, responseTimeoutHours } = instance.configSnapshot;
    const deadline = new Date(Date.now() + responseTimeoutHours * 60 * 60 * 1000);
    const deadlineTime = deadline.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const text = `🌅 Daily Standup Time - ${teamName}`;

    const blocks: (Block | KnownBlock)[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🌅 Daily Standup Time - ${teamName}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Today's Questions:*`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: questions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⏰ *Deadline:* ${deadlineTime} (${responseTimeoutHours} hours remaining)\n👥 *Waiting for:* ${instance.configSnapshot.participatingMembers.length} team members`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📝 Submit Response',
            },
            style: 'primary',
            action_id: 'submit_standup_response',
            value: instance.id,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⏭️ Skip Today',
            },
            action_id: 'skip_standup',
            value: instance.id,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Use the buttons above or type \`/standup submit\` to respond`,
          },
        ],
      },
    ];

    return { text, blocks };
  }

  formatStandupSummary(
    instance: StandupInstance,
    answers: MemberAnswer[],
    participation: ParticipationStats,
    teamName: string,
  ): { text: string; blocks: (Block | KnownBlock)[] } {
    const date = instance.targetDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const text = `📊 Daily Standup Summary - ${date}`;

    const blocks: (Block | KnownBlock)[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📊 Daily Standup Summary`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${date}*\nTeam: ${teamName} | Participation: ${participation.respondedMembers}/${participation.totalMembers} members (${Math.round(participation.responseRate)}%)`,
        },
      },
    ];

    // Add divider before responses
    if (answers.length > 0) {
      blocks.push({ type: 'divider' });

      // Group answers by question
      const questions = instance.configSnapshot.questions;

      questions.forEach((question, questionIndex) => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${question}*`,
          },
        });

        const questionAnswers = answers
          .filter((member) => member.answers.some((a) => a.questionIndex === questionIndex))
          .map((member) => {
            const answer = member.answers.find((a) => a.questionIndex === questionIndex);
            return `• *${member.memberName}:* ${answer?.answer || 'No response'}`;
          });

        if (questionAnswers.length > 0) {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: questionAnswers.join('\n'),
            },
          });
        } else {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '_No responses for this question_',
            },
          });
        }
      });
    }

    // Add missing responses if any
    if (participation.missingMembers.length > 0) {
      blocks.push(
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⏰ *Missing Responses:* ${participation.missingMembers.join(', ')}`,
          },
        },
      );
    }

    // Add next standup info
    const nextStandup = new Date(instance.targetDate);
    nextStandup.setDate(nextStandup.getDate() + 1);

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Next standup: ${nextStandup.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
        },
      ],
    });

    return { text, blocks };
  }

  createResponseModal(instanceId: string, questions: string[], _userId: string): SlackModalView {
    const blocks: (Block | KnownBlock)[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please answer the following standup questions:',
        },
      },
    ];

    questions.forEach((question, index) => {
      blocks.push({
        type: 'input',
        block_id: `question_${index}`,
        element: {
          type: 'plain_text_input',
          action_id: `answer_${index}`,
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'Enter your response...',
          },
        },
        label: {
          type: 'plain_text',
          text: `${index + 1}. ${question}`,
        },
      });
    });

    return {
      type: 'modal',
      callback_id: `standup_response_${instanceId}`,
      title: {
        type: 'plain_text',
        text: 'Daily Standup',
      },
      blocks,
      submit: {
        type: 'plain_text',
        text: 'Submit',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
    };
  }

  formatFollowupReminder(
    instance: StandupInstance,
    timeRemaining: string,
    missingMembers: string[],
  ): { text: string; blocks: (Block | KnownBlock)[] } {
    const text = '⏰ Standup Reminder';

    const blocks: (Block | KnownBlock)[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⏰ *Standup Reminder!*\n\nStill waiting for responses from:\n${missingMembers.map((name) => `• ${name}`).join('\n')}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Please reply to the standup thread above! *${timeRemaining}* remaining.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📝 Submit Now',
            },
            style: 'primary',
            action_id: 'submit_standup_response',
            value: instance.id,
          },
        ],
      },
    ];

    return { text, blocks };
  }

  formatUserStatusResponse(
    instance: StandupInstance | null,
    userHasResponded: boolean,
    teamName: string,
  ): { text: string; blocks: (Block | KnownBlock)[] } {
    if (!instance) {
      return {
        text: 'No active standup found for your team.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '📭 No active standup found for your team.',
            },
          },
        ],
      };
    }

    const deadline = new Date(
      Date.now() + instance.configSnapshot.responseTimeoutHours * 60 * 60 * 1000,
    );
    const timeRemaining = this.getTimeRemaining(deadline);
    const status = userHasResponded ? '✅ Responded' : '⏳ Pending';

    const text = `Standup Status: ${status}`;

    const blocks: (Block | KnownBlock)[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Standup Status for ${teamName}*\nYour status: ${status}\nTime remaining: ${timeRemaining}`,
        },
      },
    ];

    if (!userHasResponded) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📝 Submit Response',
            },
            style: 'primary',
            action_id: 'submit_standup_response',
            value: instance.id,
          },
        ],
      });
    }

    return { text, blocks };
  }

  formatHelpMessage(): { text: string; blocks: (Block | KnownBlock)[] } {
    const text = 'Standup Bot Help';

    const blocks: (Block | KnownBlock)[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🤖 Standup Bot Help',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available Commands:*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "• `/standup status` - Show your current standup status\n• `/standup submit` - Open modal to submit your responses\n• `/standup skip` - Skip today's standup\n• `/standup help` - Show this help message",
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*How it works:*\n1. Standups are automatically posted daily\n2. Click the "Submit Response" button or use `/standup submit`\n3. Fill out the form with your answers\n4. A summary is posted when everyone responds or time runs out',
        },
      },
    ];

    return { text, blocks };
  }

  private getTimeRemaining(deadline: Date): string {
    const now = Date.now();
    const diffMs = deadline.getTime() - now;

    if (diffMs <= 0) {
      return 'Time expired';
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}
