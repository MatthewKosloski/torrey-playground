import 'reflect-metadata';
import { Container } from 'typedi';
import { LambdaHandler } from './LambdaHandler';

export interface Event {
	program: string;
	options?: {
		semanticVersion?: string;
		flags?: string[];
	};
}

export const handler = async (event: Event) => {
	return await Container.get(LambdaHandler).handle(event);
};
