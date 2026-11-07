# First stage builds the application
FROM quay.io/sclorg/nodejs-22-c9s as builder

ENV NEXT_TELEMETRY_DISABLED=1

# Add application sources to a directory that the assemble script expects them
# and set permissions so that the container runs without root access
COPY --chown=1001:0 . /tmp/src

# Install the dependencies
RUN /usr/libexec/s2i/assemble

# Second stage copies the application to the minimal image
FROM quay.io/sclorg/nodejs-22-minimal-c9s

# Static binaries run without root and without additional system libraries.
COPY --from=mwader/static-ffmpeg:7.1.1 /ffmpeg /ffprobe /usr/local/bin/

ENV NEXT_TELEMETRY_DISABLED=1

# Copy the application source and build artifacts from the builder image to this one
COPY --from=builder $HOME $HOME

EXPOSE 3000
# Set the default command for the resulting image
CMD /usr/libexec/s2i/run
