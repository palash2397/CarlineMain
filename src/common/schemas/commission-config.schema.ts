import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { CommissionType } from '../enums/commission/commission-type.enum';

@Schema({ _id: false })
export class CommissionConfig {
  @Prop({
    type: String,
    enum: CommissionType,
    default: CommissionType.PERCENTAGE,
  })
  type: CommissionType;

  @Prop({ type: Number, default: 0, min: 0 })
  value: number;

  @Prop({ type: Boolean, default: true })
  isEnabled: boolean;
}

export const CommissionConfigSchema =
  SchemaFactory.createForClass(CommissionConfig);
