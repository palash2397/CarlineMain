import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';

import { Faq, FaqDocument } from './schema/faq.schema';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Injectable()
export class FaqService {
  constructor(@InjectModel(Faq.name) private faqModel: Model<FaqDocument>) {}

  async createFaq(dto: CreateFaqDto) {
    try {
      const faq = new this.faqModel(dto);
      await faq.save();
      return new ApiResponse(201, faq, Msg.FAQ_CREATED);
    } catch (error) {
      console.log('Error creating FAQ:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async getFaqs() {
    try {
      const faqs = await this.faqModel.find().sort({ createdAt: -1 });
      if (!faqs || faqs.length === 0) {
        return new ApiResponse(404, {}, Msg.FAQ_NOT_FOUND);
      }
      return new ApiResponse(200, faqs, Msg.FAQ_FETCHED);
    } catch (error) {
      console.log('Error fetching FAQs:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateFaq(id: string, dto: UpdateFaqDto) {
    try {
      const faq = await this.faqModel.findByIdAndUpdate(id, dto, { new: true });
      if (!faq) {
        return new ApiResponse(404, {}, Msg.FAQ_NOT_FOUND);
      }
      return new ApiResponse(200, faq, Msg.FAQ_UPDATED);
    } catch (error) {
      console.log('Error updating FAQ:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async deleteFaq(id: string) {
    try {
      const faq = await this.faqModel.findByIdAndDelete(id);
      if (!faq) {
        return new ApiResponse(404, {}, Msg.FAQ_NOT_FOUND);
      }
      return new ApiResponse(200, {}, Msg.FAQ_DELETED);
    } catch (error) {
      console.log('Error deleting FAQ:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
