#!/bin/bash

display_usage () {
	echo "This is usage info!"
}

# $1 A script flag name
# $2 The value of the flag
# $3 Indicates whether the flag value
# is surrounded in quotes
parse_flag_value() {
	if [ -n "$2" ] && [ "$3" == "true" ]; then
		# The flag value isn't null and it's
		# surrounded by quotes
		echo "$2"
	elif [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
		# The flag value isn't null and it's not
		# surrounded by quotes and thus cannot
		# start with a hyphen (or else it'll be
		# treated like another script flag name)
		echo "$2"
	else
		>&2 echo "$(basename -- "$0") $1"
		return 1
	fi
}


# Holds the Torrey compiler flags.
declare -a flags

# Loop through all of the CLI arguments and save their
# values to global variables. The currently examined 
# argument is stored in $1 and $2 is the value supplied
# to the argument.
while (( "$#" )); do
	case "$1" in
		--help|-h)
			display_usage
			shift
			# Quit successfully after displaying usage info.
			exit 70
			;;
  	--version)
			if ! semanticVersion="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
      ;;
		--program)
			if ! program="$(parse_flag_value "$1" "$2" true)"; then
				exit 70
			else
				shift 2
			fi
			;;
		--flags)
			if ! flagStr="$(parse_flag_value "$1" "$2" true)"; then
				exit 70
			else
				flags=($flagStr)
				shift 2
			fi
			;;
		--temp-dir)
			if ! tmpDir="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--compiler-name)
			if ! compilerFileName="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--compilers-root-dir)
			if ! compilersRootDir="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--compiler-dir)
			if ! compilerDir="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--compiler-path)
			if ! compilerPath="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--runtime-path)
			if ! runtimePath="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--runtime-header-path)
			if ! runtimeHeaderPath="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--asm-path)
			if ! asmPath="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--exec-path)
			if ! execPath="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--obj-code-path)
			if ! objCodePath="$(parse_flag_value "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		-*|--*=)
			>&2 echo "$(basename -- "$0") $1"
			exit 71
			;;
		*)
			>&2 echo "$(basename -- "$0") $1"
			exit 72
			;;
	esac
done

missingArgs=()
if [ -z "$semanticVersion" ]; then
	missingArgs+=("--version")
fi

if [ -z "$program" ]; then
	missingArgs+=("--program")
fi

if [ -z "$tmpDir" ]; then
	missingArgs+=("--temp-dir")
fi

if [ -z "$compilerFileName" ]; then
	missingArgs+=("--compiler-name")
fi

if [ -z "$compilersRootDir" ]; then
	missingArgs+=("--compilers-root-dir")
fi

if [ -z "$compilerDir" ]; then
	missingArgs+=("--compiler-dir")
fi

if [ -z "$compilerPath" ]; then
	missingArgs+=("--compiler-path")
fi

if [ -z "$runtimePath" ]; then
	missingArgs+=("--runtime-path")
fi

if [ -z "$runtimeHeaderPath" ]; then
	missingArgs+=("--runtime-header-path")
fi

if [ -z "$asmPath" ]; then
	missingArgs+=("--asm-path")
fi

if [ -z "$execPath" ]; then
	missingArgs+=("--exec-path")
fi

if [ -z "$objCodePath" ]; then
	missingArgs+=("--obj-code-path")
fi

if [ "${#missingArgs[@]}" -gt 0 ]; then
	>&2 echo "$(basename -- "$0") ${missingArgs[*]}"
	exit 73
fi

# Now, we will check to make sure that the selected compiler
# and its dependencies are installed and that the compiler can 
# be executed by the Lambda user. Returned status codes will 
# eventually be mapped to error messages by the parent process
# and then sent to the Lambda consumer as 500s.

# Check if the compiler is installed 
# at the expected location.
if [ ! -f "$compilerPath" ]; then
  exit 64
fi

# Check if the compiler runtime is installed 
# at the expected location.
if [ ! -f "$runtimePath" ]; then
  exit 65
fi

# Check if the compiler runtime header is installed 
# at the expected location.
if [ ! -f "$runtimeHeaderPath" ]; then
  exit 66
fi

# Check if we have permission to execute the compiler.
if [ ! -x "$compilerPath" ]; then
  exit 67
fi

# Check if gcc dependency is installed.
if [ "$(type -t gcc)" != "file" ]; then
  exit 68
fi

# Check if jvm dependency is installed.
if [ "$(type -t java)" != "file" ]; then
  exit 69
fi 

if [ "${#flags[@]}" -ne "0" ]; then
	# There are compiler flags, so just
	# run the compiler with them.
	echo "$program" | java -jar $compilerPath ${flags[@]}
else
	# There aren't any compiler flags, so just
	# compile, assemble, and execute.

	# TODO:
	# Check if we are allowed to write to the assembly file.
	# Check if we are allowed to read from $runtimePath.
	# Check if we are allowed to write to $objCodePath.
	# Check if we are allowed to write to $execPath.
	# Check if we are allowed to execute $execPath.

	echo "$program" | java -jar $compilerPath -S > $asmPath

	if [ $? -eq 0 ]; then
	  # The compiler terminated normally,
		# so let's try to assemble and run.
		gcc -c $runtimePath -o $objCodePath \
			&& gcc $asmPath $objCodePath -o $execPath \
			&& $execPath \
			&& rm $asmPath $objCodePath $execPath
	fi
fi

# If we reach this point, the script has run successfully,
# so we indicate this by exiting with zero. If we didn't
# exit with zero here, then this script would return with 
# the exit code that the compiler exited with.
exit 0