import { Matches } from 'class-validator';
import { MONEY_4 } from '../../common/money';

export class CompleteBuildDto {
  @Matches(MONEY_4, {
    message: 'qtyProduced must be a number with up to 4 decimals',
  })
  qtyProduced!: string;
}
