import { Module } from '@nestjs/common';
import { ProjectKitsController } from './project-kits.controller';
import { ProjectKitsService } from './project-kits.service';

// PrismaModule is @Global, so no imports are needed here.
@Module({
  controllers: [ProjectKitsController],
  providers: [ProjectKitsService],
})
export class ProjectKitsModule {}
