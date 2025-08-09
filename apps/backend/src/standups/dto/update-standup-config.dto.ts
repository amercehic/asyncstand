import { PartialType } from '@nestjs/swagger';
import { CreateStandupConfigDto } from '@/standups/dto/create-standup-config.dto';

export class UpdateStandupConfigDto extends PartialType(CreateStandupConfigDto) {}
