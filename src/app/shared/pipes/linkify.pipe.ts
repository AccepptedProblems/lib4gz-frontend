import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'linkify',
  standalone: true,
})
export class LinkifyPipe implements PipeTransform {
  constructor(private readonly sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';
    const linked = this.linkifyText(value);
    return this.sanitizer.bypassSecurityTrustHtml(linked);
  }

  private linkifyText(text: string): string {
    // Split into HTML-tag segments vs plain-text segments
    // Skip URLs already inside <a> tags or HTML attributes
    const parts: string[] = [];
    let lastIndex = 0;

    const tagRegex = /<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>/gi;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(this.replaceUrls(text.substring(lastIndex, match.index)));
      }
      parts.push(match[0]);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(this.replaceUrls(text.substring(lastIndex)));
    }

    return parts.join('');
  }

  private replaceUrls(text: string): string {
    const urlRegex = /(https?:\/\/[^\s<>"')\]]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }
}
