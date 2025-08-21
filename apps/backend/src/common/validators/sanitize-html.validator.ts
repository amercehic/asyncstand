import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Create a DOMPurify instance with JSDOM
const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window & typeof globalThis);

export interface SanitizeHtmlOptions {
  allowedTags?: string[];
  allowedAttributes?: string[];
  stripUnknownTags?: boolean;
  maxLength?: number;
}

@ValidatorConstraint({ name: 'SanitizeHtml', async: false })
@Injectable()
export class SanitizeHtmlConstraint implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments): boolean {
    if (!text || typeof text !== 'string') {
      return true; // Let other validators handle null/undefined
    }

    const options = (args.constraints[0] as SanitizeHtmlOptions) || {};

    try {
      const sanitized = this.sanitizeHtml(text, options);

      // Check if sanitization changed the input (indicates potentially dangerous content)
      if (sanitized !== text) {
        return false;
      }

      // Check length if specified
      if (options.maxLength && sanitized.length > options.maxLength) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    const options = (args.constraints[0] as SanitizeHtmlOptions) || {};

    if (options.maxLength) {
      return `${args.property} contains forbidden HTML content or exceeds maximum length of ${options.maxLength} characters`;
    }

    return `${args.property} contains forbidden HTML tags or attributes`;
  }

  private sanitizeHtml(html: string, options: SanitizeHtmlOptions): string {
    const config: DOMPurify.Config = {
      ALLOWED_TAGS: options.allowedTags || ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: options.allowedAttributes || [],
      KEEP_CONTENT: !options.stripUnknownTags,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    };

    return String(purify.sanitize(html, config));
  }
}

export function SanitizeHtml(options?: SanitizeHtmlOptions, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: SanitizeHtmlConstraint,
    });
  };
}

/**
 * Strict HTML sanitization - only allows basic formatting
 */
export const SanitizeHtmlStrict = (validationOptions?: ValidationOptions) =>
  SanitizeHtml(
    {
      allowedTags: ['b', 'i', 'em', 'strong'],
      allowedAttributes: [],
      stripUnknownTags: true,
    },
    validationOptions,
  );

/**
 * Rich text HTML sanitization - allows more formatting options
 */
export const SanitizeHtmlRich = (validationOptions?: ValidationOptions) =>
  SanitizeHtml(
    {
      allowedTags: [
        'p',
        'br',
        'strong',
        'em',
        'b',
        'i',
        'u',
        's',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'blockquote',
        'code',
        'pre',
        'a',
      ],
      allowedAttributes: ['href', 'target', 'rel'],
      stripUnknownTags: true,
    },
    validationOptions,
  );
