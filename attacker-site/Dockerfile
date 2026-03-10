FROM nginx:alpine

# Copy static files
COPY pages/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 9000
