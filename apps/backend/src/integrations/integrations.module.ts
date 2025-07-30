import { Module } from '@nestjs/common';
import { SlackModule } from '@/integrations/slack/slack.module';

@Module({
  imports: [SlackModule],
  exports: [SlackModule],
})
export class IntegrationsModule {}
