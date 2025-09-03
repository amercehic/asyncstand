import { Module } from '@nestjs/common';
import { FeatureService } from '@/features/feature.service';
import { FeatureController } from '@/features/feature.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { CacheModule } from '@/common/cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureModule {}
