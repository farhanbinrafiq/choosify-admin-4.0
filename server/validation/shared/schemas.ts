import { z } from 'zod';
import {
  paginationValidator,
  searchValidator,
  slugValidator,
} from './validators';

export const PaginationSchema = paginationValidator;
export const SearchSchema = searchValidator;
export const SlugSchema = slugValidator;

const nonEmptyId = z.string().trim().min(1, 'Identifier is required').max(128);

export const ProductIdSchema = nonEmptyId;
export const SellerIdSchema = nonEmptyId;
export const BrandIdSchema = nonEmptyId;
export const CategoryIdSchema = nonEmptyId;
export const UserIdSchema = nonEmptyId;
